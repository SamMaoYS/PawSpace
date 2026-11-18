#!/bin/zsh
cd -- "${0:A:h}" || exit 1
exec python3 - <<'PY'
import http.server
import webbrowser
with http.server.ThreadingHTTPServer(('127.0.0.1', 0), http.server.SimpleHTTPRequestHandler) as server:
    url = f'http://127.0.0.1:{server.server_port}/'
    print(f'房间漫游已开启  {url}\n按 Ctrl+C 关闭。', flush=True)
    webbrowser.open(url)
    try:
        server.serve_forever()
    except KeyboardInterrupt:
        pass
PY
