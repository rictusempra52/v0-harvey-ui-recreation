# ocr-rag-processing Skill

## When to use
- When working with OCR data or RAG (Retrieval-Augmented Generation) logic.
- When implementing citation and highlighting features for PDFs.

## Guidelines
### 1. OCR Handling
- **Coordinate System**: Be precise with OCR coordinates (left, top, width, height). Ensure they match the PDF rendering scale.
- **Normalization**: Normalize text extracted from OCR to improve matching accuracy.

### 2. RAG Implementation
- **Chunking**: Optimize document chunking strategies to maintain context while staying within token limits.
- **Context Enhancement**: Include useful metadata in chunks to help the AI provide accurate answers.

### 3. Citations & Highlighting
- **Parsing**: Ensure the AI returns citations in a consistent format that the frontend can parse.
- **Linking**: Links should lead directly to the specific page and coordinates in the PDF viewer.
