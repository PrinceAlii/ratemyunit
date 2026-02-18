import sys, os, base64, json

base = 'C:/Users/alibo/Desktop/Tech/ratemyunit'

# Read config from file
with open(os.path.join(base, 'tmp_files_config.json'), 'r') as f:
    config = json.load(f)

for rel_path, b64_content in config.items():
    full_path = os.path.join(base, rel_path)
    content = base64.b64decode(b64_content).decode('utf-8')
    with open(full_path, 'w', newline='
') as f:
        f.write(content)
    print(f'Written: {rel_path} ({len(content)} bytes)')

# Clean up
os.remove(os.path.join(base, 'tmp_files_config.json'))
os.remove(os.path.join(base, 'tmp_file_writer.py'))
print('Done - temp files cleaned up')
