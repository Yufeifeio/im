#!/usr/bin/env python3
"""Render a private Tinode configuration; never overwrite stable identity keys."""
import base64, hashlib, hmac, json, os, pathlib, secrets, subprocess
root = pathlib.Path(__file__).resolve().parent.parent
private = root / '.runtime'
private.mkdir(mode=0o700, exist_ok=True)
config = private / 'tinode.json'
if config.exists():
    raise SystemExit('Configuration exists; refusing to replace identity keys.')
count = subprocess.check_output(['runuser','-u','postgres','--','psql','-d','tinode','-Atc','SELECT count(*) FROM users'], text=True).strip()
if count != '0':
    raise SystemExit('Existing accounts require preserving the previous UID key; manual migration required.')
password = secrets.token_hex(32)
sql = f"ALTER ROLE tinode PASSWORD '{password}' NOCREATEDB; GRANT CONNECT ON DATABASE tinode TO tinode; GRANT USAGE ON SCHEMA public TO tinode; GRANT SELECT,INSERT,UPDATE,DELETE ON ALL TABLES IN SCHEMA public TO tinode; GRANT USAGE,SELECT ON ALL SEQUENCES IN SCHEMA public TO tinode;"
subprocess.run(['runuser','-u','postgres','--','psql','-v','ON_ERROR_STOP=1','-d','tinode'],input=sql,text=True,check=True,stdout=subprocess.DEVNULL)
salt = secrets.token_bytes(32)
b64 = lambda n: base64.b64encode(secrets.token_bytes(n)).decode()
cfg = dict(push=[],listen='127.0.0.1:6060',grpc_listen='',static_mount='/',api_key_salt=base64.b64encode(salt).decode(),max_message_size=131072,max_subscriber_count=128,expvar='-',auth_config={'basic':{'add_to_tags':True,'min_login_length':4,'min_password_length':12},'token':{'expire_in':86400,'serial_num':1,'key':b64(32)}},store_config={'uid_key':b64(16),'use_adapter':'postgres','adapters':{'postgres':{'User':'tinode','Passwd':password,'Host':'127.0.0.1','Port':'5432','DBName':'tinode','SSLMode':'disable','max_open_conns':20,'max_idle_conns':5}}})
cfg['media'] = {'use_handler': 'fs', 'max_size': 8388608, 'gc_period': 60, 'gc_block_size': 100, 'handlers': {'fs': {'upload_dir': '/www/wwwroot/github/im/.runtime/uploads', 'cors_origins': ['https://im.cyfljj.com']}}}
config.write_text(json.dumps(cfg,indent=2))
config.chmod(0o600)
header = bytes([1,0,0,0,0,1,0,0])
# Non-root app key is intentionally public; signing salt stays private.
key = base64.urlsafe_b64encode(header+hmac.new(salt,header,hashlib.md5).digest()).decode()
(private/'client-key').write_text(key)
print('Private configuration created; no demo accounts loaded.')
