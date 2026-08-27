# Public-data model training

These commands fine-tune research baselines from public datasets. They do not
constitute clinical validation and the data is not prescription-specific.

From the `elderly-care-medication` directory:

```powershell
& .\ai-service\venv\Scripts\python.exe -m pip install -r .\ai-service\requirements-training.txt
& .\ai-service\venv\Scripts\python.exe .\ai-service\training\train_models.py ner --epochs 1
& .\ai-service\venv\Scripts\python.exe .\ai-service\training\train_models.py ddi --epochs 1
& .\ai-service\venv\Scripts\python.exe .\ai-service\training\train_models.py ocr --epochs 1
```

For a quick CPU smoke run, add `--max-train 32 --max-eval 8`. Full OCR fine-tuning
requires substantial disk space and is much faster with a CUDA GPU.

Datasets:

- `honest-boii-001/IAM-line`: handwritten image/transcription pairs for OCR.
- `tner/bc5cdr`: biomedical Chemical/Disease token labels; Chemical is mapped to
  the app's `MEDICATION` label.
- `bigbio/ddi_corpus`: annotated biomedical drug entities and interaction
  relations for DDI relation classification.

The OCR and NER public datasets do not contain prescription dosage/frequency
labels. Those fields remain rule-based until prescription-specific annotations
are available.
