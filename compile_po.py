import os
import struct

def compile_po(po_path, mo_path):
    with open(po_path, 'r', encoding='utf-8') as f:
        po_content = f.read()

    lines = po_content.splitlines()
    messages = {}
    msgid = []
    msgstr = []
    in_msgid = False
    in_msgstr = False

    for line in lines:
        line = line.strip()
        if not line or line.startswith('#'):
            continue
        if line.startswith('msgid '):
            if msgid and msgstr:
                messages["\n".join(msgid)] = "\n".join(msgstr)
                msgid = []
                msgstr = []
            in_msgid = True
            in_msgstr = False
            raw = line[6:].strip()
            if raw.startswith('"') and raw.endswith('"'):
                msgid.append(raw[1:-1].replace('\\n', '\n').replace('\\"', '"'))
        elif line.startswith('msgstr '):
            in_msgid = False
            in_msgstr = True
            raw = line[7:].strip()
            if raw.startswith('"') and raw.endswith('"'):
                msgstr.append(raw[1:-1].replace('\\n', '\n').replace('\\"', '"'))
        elif line.startswith('"') and line.endswith('"'):
            val = line[1:-1].replace('\\n', '\n').replace('\\"', '"')
            if in_msgid:
                msgid.append(val)
            elif in_msgstr:
                msgstr.append(val)

    if msgid and msgstr:
        messages["\n".join(msgid)] = "\n".join(msgstr)

    keys = sorted(messages.keys())
    ids = [k.encode('utf-8') for k in keys]
    strs = [messages[k].encode('utf-8') for k in keys]

    keystart = 7 * 4 + len(keys) * 8 * 2
    valstart = keystart + sum(len(k) + 1 for k in ids)

    key_offsets = []
    val_offsets = []

    k_off = keystart
    for k in ids:
        key_offsets.append((len(k), k_off))
        k_off += len(k) + 1

    v_off = valstart
    for v in strs:
        val_offsets.append((len(v), v_off))
        v_off += len(v) + 1

    output = bytearray()
    output.extend(struct.pack('<I', 0x950412de))
    output.extend(struct.pack('<I', 0))
    output.extend(struct.pack('<I', len(keys)))
    output.extend(struct.pack('<I', 7 * 4))
    output.extend(struct.pack('<I', 7 * 4 + len(keys) * 8))
    output.extend(struct.pack('<I', 0))
    output.extend(struct.pack('<I', 0))

    for length, offset in key_offsets:
        output.extend(struct.pack('<II', length, offset))

    for length, offset in val_offsets:
        output.extend(struct.pack('<II', length, offset))

    for k in ids:
        output.extend(k)
        output.append(0)

    for v in strs:
        output.extend(v)
        output.append(0)

    os.makedirs(os.path.dirname(mo_path), exist_ok=True)
    with open(mo_path, 'wb') as f:
        f.write(output)
    print(f"Successfully compiled {po_path} -> {mo_path} ({len(keys)} strings)")

if __name__ == '__main__':
    base = os.path.dirname(os.path.abspath(__file__))
    po = os.path.join(base, 'locale', 'hi', 'LC_MESSAGES', 'django.po')
    mo = os.path.join(base, 'locale', 'hi', 'LC_MESSAGES', 'django.mo')
    compile_po(po, mo)
