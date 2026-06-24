# Project agent memory

This file is the project's committed home for project-intrinsic agent knowledge: build, test, release, architecture, and sharp-edge notes that should travel with the code.

- Add durable project-specific notes here as they are discovered through real work.

## Knowledge Base File Preview

- `GET /files/{id}/preview` streams file bytes; proxied at `/api/files/{id}/preview`
- Use `knowledgeService.getPreview(id)` to fetch as blob → `URL.createObjectURL(blob)`
- Always clean up object URLs with `URL.revokeObjectURL()` in effect cleanup
- `FilePreviewModal` wraps preview content in a sub-component with `key={file.id}` to force remount on file change (avoids `react-hooks/set-state-in-effect` lint errors)
- Image preview uses `<img>` with blob URL (Next `<Image>` doesn't support object URLs)
- PDF preview uses `<iframe>` with blob URL
- Other file types show metadata + download button
