import os
import re

path = r'c:\Users\z003kyph\Downloads\Add-on_ImmoPlan-latest\Add-on_ImmoPlan-latest\components\PropertyAssetManager.tsx'
out_path = r'C:\Users\z003kyph\.gemini\antigravity-ide\brain\1fc2ca56-4cfa-4d10-ac75-e04cf250563f\scratch\scan_results.txt'

with open(path, 'r', encoding='utf-8') as f:
    lines = f.readlines()

results = []
results.append(f"Total lines: {len(lines)}")

# Search for color codes
for i, line in enumerate(lines):
    # check for emoji
    emojis = re.findall(r'[^\x00-\x7F]+', line)
    if emojis:
        # filter out standard letters like accent letters in Italian (à, è, é, ì, ò, ù) and €
        non_ascii_cleaned = [e for e in emojis if not any(c in 'àèéìòù°€’' for c in e)]
        if non_ascii_cleaned:
            results.append(f"Line {i+1} emoji/non-ascii: {line.strip()}")
    
    # check for orange, coral, etc.
    if 'orange' in line.lower() or 'coral' in line.lower():
        results.append(f"Line {i+1} color keyword: {line.strip()}")

    # check for chart, PieChart, LineChart
    if 'PieChart' in line or 'LineChart' in line or 'AreaChart' in line:
        results.append(f"Line {i+1} Chart: {line.strip()}")

with open(out_path, 'w', encoding='utf-8') as f:
    f.write('\n'.join(results))

print("Results written to scan_results.txt")
