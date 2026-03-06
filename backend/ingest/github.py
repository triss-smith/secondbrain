"""
Ingest a GitHub repository.
Clones it to a temp directory, reads README + source files, returns combined text.
"""
import asyncio
import os
import tempfile

from backend.ingest.base import IngestResult

# File extensions to index
CODE_EXTENSIONS = {
    ".py", ".ts", ".tsx", ".js", ".jsx", ".go", ".rs", ".java",
    ".cpp", ".c", ".h", ".cs", ".rb", ".md", ".txt", ".yaml", ".yml", ".toml",
}
MAX_FILES = 50
MAX_FILE_SIZE_BYTES = 50_000


def _ingest_sync(url: str) -> IngestResult:
    import git

    # Extract repo name from URL
    repo_name = url.rstrip("/").split("/")[-1].replace(".git", "")

    with tempfile.TemporaryDirectory() as tmpdir:
        try:
            git.Repo.clone_from(url, tmpdir, depth=1)
        except Exception as e:
            return IngestResult(
                title=repo_name,
                content=f"Failed to clone repository: {e}",
                content_type="github",
                source_url=url,
            )

        files_text = _collect_files(tmpdir)

    content = f"GitHub Repository: {url}\n\n" + "\n\n---\n\n".join(files_text)

    return IngestResult(
        title=repo_name,
        content=content,
        content_type="github",
        source_url=url,
        meta={"file_count": len(files_text)},
    )


def _collect_files(root: str) -> list[str]:
    collected = []
    skip_dirs = {".git", "node_modules", "__pycache__", ".venv", "dist", "build"}

    for dirpath, dirnames, filenames in os.walk(root):
        dirnames[:] = [d for d in dirnames if d not in skip_dirs]
        for fname in filenames:
            if len(collected) >= MAX_FILES:
                break
            _, ext = os.path.splitext(fname)
            if ext.lower() not in CODE_EXTENSIONS:
                continue
            fpath = os.path.join(dirpath, fname)
            if os.path.getsize(fpath) > MAX_FILE_SIZE_BYTES:
                continue
            try:
                with open(fpath, "r", encoding="utf-8", errors="ignore") as f:
                    text = f.read()
                rel = os.path.relpath(fpath, root)
                collected.append(f"### {rel}\n```\n{text}\n```")
            except Exception:
                continue

    return collected


async def ingest(url: str) -> IngestResult:
    loop = asyncio.get_event_loop()
    return await loop.run_in_executor(None, _ingest_sync, url)
