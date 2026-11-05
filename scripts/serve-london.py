#!/usr/bin/env python3
"""Serve the repository locally, with no installation or build step."""
import argparse
import functools
import http.server
from pathlib import Path

parser = argparse.ArgumentParser(description=__doc__)
parser.add_argument('--port', type=int, default=8877)
args = parser.parse_args()
root = Path(__file__).resolve().parent.parent
handler = functools.partial(http.server.SimpleHTTPRequestHandler, directory=str(root))
server = http.server.ThreadingHTTPServer(('127.0.0.1', args.port), handler)
print(f'Londres : http://127.0.0.1:{args.port}/london-code-demo.html', flush=True)
try:
    server.serve_forever()
except KeyboardInterrupt:
    pass
finally:
    server.server_close()
