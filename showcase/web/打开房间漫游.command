#!/bin/zsh
cd -- "${0:A:h}" || exit 1
exec python3 - <<'PY'
import errno
import http.server
import webbrowser
# Keep the origin stable so restarting the report preserves locally collected answers.
try:
    server = http.server.ThreadingHTTPServer(('127.0.0.1', 8731), http.server.SimpleHTTPRequestHandler)
except OSError as error:
    if error.errno != errno.EADDRINUSE:
        raise
    server = http.server.ThreadingHTTPServer(('127.0.0.1', 0), http.server.SimpleHTTPRequestHandler)
    print('常用端口正在使用。此临时地址有独立的本机答卷，请及时导出。', flush=True)
with server:
    url = f'http://127.0.0.1:{server.server_port}/'
    print(f'PawSpace 汇报页已开启  {url}\n按 Ctrl+C 关闭。', flush=True)
    webbrowser.open(url)
    try:
        server.serve_forever()
    except KeyboardInterrupt:
        pass
PY
