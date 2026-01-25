#!/usr/bin/env python3
import os

os.chdir(r"c:\Users\z003kyph\Downloads\addon-mm's-property---db Stable")

# Leggi file
with open('App.tsx', 'r', encoding='utf-8') as f:
    content = f.read()

# Estrai solo la sezione buona
start_marker = 'import React, { useState'
end_marker = 'export default App;'

start_idx = content.find(start_marker)
end_idx = content.rfind(end_marker)

if start_idx != -1 and end_idx != -1:
    clean_content = content[start_idx:end_idx+len(end_marker)]
    
    # Scrivi file pulito
    with open('App.tsx', 'w', encoding='utf-8') as f:
        f.write(clean_content)
    
    print("✓ App.tsx pulito con successo")
else:
    print("✗ Non trovati i marcatori nel file")
