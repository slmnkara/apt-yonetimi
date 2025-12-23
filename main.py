import os
import pathspec
import pyperclip

# ================= AYARLAR =================

# 1. Bu uzantılara sahip dosyalar ASLA kopyalanmaz.
# Not: Uzantıları nokta ile başlatın (örn: .log)
ENGELLENEN_UZANTILAR = {
    '.exe', '.dll', '.so', '.dylib', '.bin',  # Sistem dosyaları
    '.png', '.jpg', '.jpeg', '.gif', '.ico', '.svg', '.webp', # Görseller
    '.pyc', '.pyo', '.pyd', # Python derlenmiş dosyaları
    '.log', '.lock', # Log ve kilit dosyaları
    '.zip', '.tar', '.gz', '.rar', '.7z', # Arşivler
    '.pdf', '.docx', '.xlsx' # Ofis dosyaları
}

# 2. Bu isme sahip dosyalar ASLA kopyalanmaz (uzantıdan bağımsız).
ENGELLENEN_DOSYA_ISIMLERI = {
    'package-lock.json',
    'yarn.lock',
    'poetry.lock',
    'Cargo.lock',
    '.DS_Store',
    'Thumbs.db',
    'README.md',
    'LICENSE',
    'CNAME',
    '.gitignore'
}

# ===========================================

def get_gitignore_spec(root_path):
    """
    .gitignore dosyasını okur ve pathspec objesi oluşturur.
    """
    gitignore_path = os.path.join(root_path, '.gitignore')
    lines = []
    
    if os.path.exists(gitignore_path):
        with open(gitignore_path, 'r', encoding='utf-8') as f:
            lines = f.readlines()
            
    # .git klasörünü ve scriptin kendisini her zaman hariç tutalım
    lines.append(".git/")
    lines.append(os.path.basename(__file__)) 
    
    return pathspec.PathSpec.from_lines('gitwildmatch', lines)

def is_excluded_by_extension_or_name(filename):
    """
    Dosya ismine veya uzantısına göre manuel engelleme kontrolü yapar.
    """
    # 1. Tam isim kontrolü
    if filename in ENGELLENEN_DOSYA_ISIMLERI:
        return True
        
    # 2. Uzantı kontrolü (Lower case yaparak kontrol eder)
    _, ext = os.path.splitext(filename)
    if ext.lower() in ENGELLENEN_UZANTILAR:
        return True
        
    return False

def scan_and_copy():
    root_path = os.getcwd()
    spec = get_gitignore_spec(root_path)
    
    final_output = []
    files_processed = 0
    files_skipped_custom = 0

    print(f"Dizin taranıyor: {root_path}")
    print("------------------------------------------")

    for current_root, dirs, files in os.walk(root_path):
        # Klasörleri .gitignore'a göre filtrele
        dirs[:] = [d for d in dirs if not spec.match_file(os.path.relpath(os.path.join(current_root, d), root_path))]

        for file in files:
            file_path = os.path.join(current_root, file)
            rel_path = os.path.relpath(file_path, root_path)

            # 1. Gitignore kontrolü
            if spec.match_file(rel_path):
                continue

            # 2. Manuel Uzantı ve İsim kontrolü (YENİ ÖZELLİK)
            if is_excluded_by_extension_or_name(file):
                # print(f"Atlandı (Manuel Kural): {rel_path}") # Çok kalabalık olmasın diye kapalı
                files_skipped_custom += 1
                continue

            # 3. İçeriği okuma
            try:
                with open(file_path, 'r', encoding='utf-8') as f:
                    content = f.read()
                    
                entry = f"--- DOSYA: {rel_path} ---\n:\n{content}\n\n"
                final_output.append(entry)
                files_processed += 1
                print(f"Eklendi: {rel_path}")

            except UnicodeDecodeError:
                print(f"Atlandı (Binary/Okunamaz): {rel_path}")
            except Exception as e:
                print(f"Hata ({rel_path}): {e}")

    # Sonucu birleştir ve kopyala
    full_text = "".join(final_output)

    if full_text:
        pyperclip.copy(full_text)
        print("------------------------------------------")
        print(f"ÖZET:")
        print(f"- {files_processed} dosya kopyalandı.")
        print(f"- {files_skipped_custom} dosya manuel uzantı ayarlarınla engellendi.")
        print(f"\nİçerik panoya kopyalandı! (CTRL+V ile yapıştırabilirsin)")
    else:
        print("Kopyalanacak uygun dosya bulunamadı.")

if __name__ == "__main__":
    scan_and_copy()