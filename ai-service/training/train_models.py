"""Fine-tune the three research models used by the medication prototype.

Public baselines:
  OCR: IAM line-level handwriting (Hugging Face: honest-boii-001/IAM-line)
  NER: BioCreative V CDR (Hugging Face: tner/bc5cdr)
  DDI: DDI Corpus (Hugging Face: bigbio/ddi_corpus)

These datasets are not prescription-specific. The resulting checkpoints are
research baselines and must not be described as clinically validated.
"""

from __future__ import annotations

import argparse
import json
from pathlib import Path


ROOT = Path(__file__).resolve().parents[1]
MODEL_ROOT = ROOT / "models"


def _output_dir(name: str, args):
    return MODEL_ROOT / (f"{name}-{args.run_name}" if args.run_name else name)


def _limit(dataset, limit: int | None):
    dataset = dataset.shuffle(seed=42)
    if limit and limit < len(dataset):
        return dataset.select(range(limit))
    return dataset


def train_ner(args):
    from datasets import load_dataset
    from transformers import (
        AutoModelForTokenClassification,
        AutoTokenizer,
        DataCollatorForTokenClassification,
        Trainer,
        TrainingArguments,
    )

    labels = ["O", "B-MEDICATION", "I-MEDICATION", "B-DISEASE", "I-DISEASE"]
    label_to_id = {label: i for i, label in enumerate(labels)}
    original = {0: "O", 1: "B-Chemical", 2: "B-Disease", 3: "I-Disease", 4: "I-Chemical"}

    ds = load_dataset("tner/bc5cdr")
    train = _limit(ds["train"], args.max_train)
    valid = _limit(ds["validation"], args.max_eval)
    tokenizer = AutoTokenizer.from_pretrained(args.ner_base)

    def encode(batch):
        encoded = tokenizer(batch["tokens"], is_split_into_words=True, truncation=True, max_length=256)
        encoded["labels"] = []
        for row, encoding in zip(batch["tags"], encoded.encodings):
            word_ids = encoding.word_ids
            aligned = []
            previous = None
            for word_id in word_ids:
                if word_id is None:
                    aligned.append(-100)
                elif word_id != previous:
                    source = original[int(row[word_id])]
                    source = source.replace("Chemical", "MEDICATION").replace("Disease", "DISEASE").upper()
                    aligned.append(label_to_id[source])
                else:
                    source = original[int(row[word_id])]
                    if source.endswith("Chemical"):
                        aligned.append(label_to_id["I-MEDICATION"])
                    elif source.endswith("Disease"):
                        aligned.append(label_to_id["I-DISEASE"])
                    else:
                        aligned.append(label_to_id["O"])
                previous = word_id
            encoded["labels"].append(aligned)
        return encoded

    train = train.map(encode, batched=True, remove_columns=train.column_names)
    valid = valid.map(encode, batched=True, remove_columns=valid.column_names)
    out = _output_dir("ner", args)
    def metrics(eval_prediction):
        from sklearn.metrics import accuracy_score, f1_score
        logits, gold = eval_prediction
        pred = logits.argmax(-1)
        mask = gold != -100
        y_true = gold[mask].reshape(-1)
        y_pred = pred[mask].reshape(-1)
        return {
            "token_accuracy": float(accuracy_score(y_true, y_pred)),
            "token_macro_f1": float(f1_score(y_true, y_pred, average="macro", zero_division=0)),
        }

    model = AutoModelForTokenClassification.from_pretrained(
        args.ner_base,
        num_labels=len(labels),
        id2label={i: label for i, label in enumerate(labels)},
        label2id=label_to_id,
    )
    trainer = Trainer(
        model=model,
        args=TrainingArguments(
            output_dir=str(out),
            learning_rate=args.learning_rate,
            per_device_train_batch_size=args.batch_size,
            per_device_eval_batch_size=args.batch_size,
            num_train_epochs=args.epochs,
            evaluation_strategy="epoch",
            save_strategy="epoch",
            logging_steps=25,
            report_to=[],
        ),
        train_dataset=train,
        eval_dataset=valid,
        tokenizer=tokenizer,
        data_collator=DataCollatorForTokenClassification(tokenizer),
        compute_metrics=metrics,
    )
    trainer.train()
    trainer.save_model(str(out))
    tokenizer.save_pretrained(str(out))
    (out / "training_metadata.json").write_text(json.dumps({
        "dataset": "tner/bc5cdr",
        "base_model": args.ner_base,
        "labels": labels,
        "mapping": "Chemical -> MEDICATION; Disease retained as DISEASE",
        "max_train": args.max_train,
        "max_eval": args.max_eval,
    }, indent=2), encoding="utf-8")


def train_ocr(args):
    import torch
    from datasets import load_dataset
    from transformers import (
        Seq2SeqTrainer,
        Seq2SeqTrainingArguments,
        TrOCRProcessor,
        VisionEncoderDecoderModel,
    )

    raw = load_dataset("honest-boii-001/IAM-line", split="train")
    split = raw.train_test_split(test_size=0.1, seed=42)
    train = _limit(split["train"], args.max_train)
    valid = _limit(split["test"], args.max_eval)
    processor = TrOCRProcessor.from_pretrained(args.ocr_base)
    model = VisionEncoderDecoderModel.from_pretrained(args.ocr_base)
    model.config.decoder_start_token_id = processor.tokenizer.cls_token_id
    model.config.pad_token_id = processor.tokenizer.pad_token_id
    model.config.max_length = 128

    class OCRDataset(torch.utils.data.Dataset):
        def __init__(self, rows):
            self.rows = rows

        def __len__(self):
            return len(self.rows)

        def __getitem__(self, index):
            row = self.rows[index]
            pixel_values = processor(images=row["image"].convert("RGB"), return_tensors="pt").pixel_values[0]
            labels = processor.tokenizer(
                row["text"], max_length=128, padding="max_length", truncation=True
            ).input_ids
            labels = [token if token != processor.tokenizer.pad_token_id else -100 for token in labels]
            return {"pixel_values": pixel_values, "labels": torch.tensor(labels, dtype=torch.long)}

    out = _output_dir("ocr", args)

    def collate(features):
        return {
            "pixel_values": torch.stack([item["pixel_values"] for item in features]),
            "labels": torch.stack([item["labels"] for item in features]),
        }

    trainer = Seq2SeqTrainer(
        model=model,
        args=Seq2SeqTrainingArguments(
            output_dir=str(out),
            learning_rate=args.learning_rate,
            per_device_train_batch_size=args.batch_size,
            per_device_eval_batch_size=args.batch_size,
            num_train_epochs=args.epochs,
            evaluation_strategy="epoch",
            save_strategy="epoch",
            predict_with_generate=True,
            logging_steps=25,
            report_to=[],
        ),
        train_dataset=OCRDataset(train),
        eval_dataset=OCRDataset(valid),
        data_collator=collate,
    )
    trainer.train()
    trainer.save_model(str(out))
    processor.save_pretrained(str(out))
    (out / "training_metadata.json").write_text(json.dumps({
        "dataset": "honest-boii-001/IAM-line",
        "base_model": args.ocr_base,
        "note": "General handwriting OCR baseline; not prescription-specific.",
        "max_train": args.max_train,
        "max_eval": args.max_eval,
    }, indent=2), encoding="utf-8")


def _ddi_examples(documents):
    examples = []
    for document in documents:
        entities = {
            entity["id"]: " ".join(entity.get("text", []))
            for entity in document.get("entities", [])
        }
        text_parts = []
        for passage in document.get("passages", []):
            texts = passage.get("text", [])
            text_parts.extend(texts if isinstance(texts, list) else [texts])
        context = " ".join(text_parts)
        relations = document.get("relations", [])
        known = {}
        for relation in relations:
            pair = tuple(sorted((relation["arg1_id"], relation["arg2_id"])))
            known[pair] = relation.get("type", "false").lower()
        drug_ids = list(entities)
        for i, left in enumerate(drug_ids):
            for right in drug_ids[i + 1:]:
                label = known.get(tuple(sorted((left, right))), "false")
                examples.append({
                    "text": f"Drug 1: {entities[left]} Drug 2: {entities[right]} Context: {context}",
                    "label": label,
                })
    return examples


def train_ddi(args):
    from datasets import Dataset, load_dataset
    from transformers import AutoModelForSequenceClassification, AutoTokenizer, Trainer, TrainingArguments

    raw = load_dataset("bigbio/ddi_corpus", "ddi_corpus_bigbio_kb", trust_remote_code=True)
    train_examples = _ddi_examples(raw["train"])
    test_examples = _ddi_examples(raw["test"])
    if args.max_train:
        train_examples = train_examples[:args.max_train]
    if args.max_eval:
        test_examples = test_examples[:args.max_eval]
    labels = ["false", "advice", "effect", "mechanism", "int"]
    label_to_id = {label: i for i, label in enumerate(labels)}
    tokenizer = AutoTokenizer.from_pretrained(args.ddi_base)

    def encode(batch):
        encoded = tokenizer(batch["text"], truncation=True, max_length=384)
        encoded["labels"] = [label_to_id.get(label, 0) for label in batch["label"]]
        return encoded

    train = Dataset.from_list(train_examples).map(encode, batched=True, remove_columns=["text", "label"])
    test = Dataset.from_list(test_examples).map(encode, batched=True, remove_columns=["text", "label"])
    out = _output_dir("ddi", args)
    def metrics(eval_prediction):
        from sklearn.metrics import accuracy_score, f1_score
        logits, gold = eval_prediction
        pred = logits.argmax(-1)
        return {
            "accuracy": float(accuracy_score(gold, pred)),
            "macro_f1": float(f1_score(gold, pred, average="macro", zero_division=0)),
        }

    model = AutoModelForSequenceClassification.from_pretrained(
        args.ddi_base,
        num_labels=len(labels),
        id2label={i: label for i, label in enumerate(labels)},
        label2id=label_to_id,
    )
    trainer = Trainer(
        model=model,
        args=TrainingArguments(
            output_dir=str(out),
            learning_rate=args.learning_rate,
            per_device_train_batch_size=args.batch_size,
            per_device_eval_batch_size=args.batch_size,
            num_train_epochs=args.epochs,
            evaluation_strategy="epoch",
            save_strategy="epoch",
            logging_steps=25,
            report_to=[],
        ),
        train_dataset=train,
        eval_dataset=test,
        tokenizer=tokenizer,
        compute_metrics=metrics,
    )
    trainer.train()
    trainer.save_model(str(out))
    tokenizer.save_pretrained(str(out))
    (out / "training_metadata.json").write_text(json.dumps({
        "dataset": "bigbio/ddi_corpus",
        "base_model": args.ddi_base,
        "labels": labels,
        "note": "DDI relation benchmark; not a clinical severity predictor.",
        "max_train": args.max_train,
        "max_eval": args.max_eval,
    }, indent=2), encoding="utf-8")


def main():
    parser = argparse.ArgumentParser(description="Train public-data research baselines")
    parser.add_argument("model", choices=["ocr", "ner", "ddi", "all"])
    parser.add_argument("--max-train", type=int, default=None)
    parser.add_argument("--max-eval", type=int, default=None)
    parser.add_argument("--epochs", type=float, default=1.0)
    parser.add_argument("--batch-size", type=int, default=2)
    parser.add_argument("--learning-rate", type=float, default=5e-5)
    parser.add_argument("--ocr-base", default="microsoft/trocr-base-handwritten")
    parser.add_argument("--ner-base", default="dmis-lab/biobert-base-cased-v1.1")
    parser.add_argument("--ddi-base", default="dmis-lab/biobert-base-cased-v1.1")
    parser.add_argument("--run-name", default="")
    args = parser.parse_args()
    if args.model in ("ocr", "all"):
        train_ocr(args)
    if args.model in ("ner", "all"):
        train_ner(args)
    if args.model in ("ddi", "all"):
        train_ddi(args)


if __name__ == "__main__":
    main()
