"""Sync only public Grid Studio app files; never traverse private samples."""
from pathlib import Path

root = Path(__file__).resolve().parents[2]
source = root / 'grid-studio'
target = root / 'surveyapps/vendor/grid-studio'
allowed = ['index.html', 'tests.html', 'chips.js', 'js', 'css']
files = {}
for name in allowed:
    entry = source / name
    for item in ([entry] if entry.is_file() else entry.rglob('*')):
        if item.is_symlink():
            raise RuntimeError('Symlinks are not permitted')
        if item.is_file():
            relative = item.relative_to(source)
            if 'samples' in relative.parts:
                raise RuntimeError('Private samples forbidden')
            files[relative] = item.read_bytes()
# Apply the SUGAR workspace name to the vendored page title and toolbar.
index = Path('index.html')
files[index] = files[index].replace(b'Digital Microscope Gridoverlay Studio', b'Chocolate Bar')
# Validate the allowlist before replacing the vendor snapshot.
for item in target.rglob('*'):
    if item.is_file() and item.relative_to(target) not in files:
        item.unlink()
for relative, data in files.items():
    destination = target / relative
    destination.parent.mkdir(parents=True, exist_ok=True)
    destination.write_bytes(data)
assert {f.relative_to(target): f.read_bytes() for f in target.rglob('*') if f.is_file()} == files
print(f'Verified {len(files)} public Grid Studio files')
