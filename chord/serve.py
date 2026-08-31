#!/usr/bin/env python3
"""Dev server for the game.  Run:  python3 serve.py  [port]

Why not just `python3 -m http.server`?  Because it lets the browser cache the
ES modules: you edit js/graph.js, reload, and see the old file — with no error
to tell you so.  This server sends `Cache-Control: no-store` on everything, so
a reload is always the code on disk.

It also refuses to be confusing about a busy port: if the game is already
being served there it says so and stops, and if something else holds the port
it moves to the next free one rather than throwing a traceback at you.

It is a convenience, not a dependency: the game is plain static files, and any
web server (or GitHub Pages) will serve it.
"""

import os
import socket
import sys
import urllib.error
import urllib.request
from http.server import SimpleHTTPRequestHandler, ThreadingHTTPServer

TITLE = 'Listening for a Cosmic Chord'
PORT_TRIES = 12  # 8000, 8001, … — enough to get past whatever else is running


class NoCacheHandler(SimpleHTTPRequestHandler):
    def end_headers(self):
        self.send_header('Cache-Control', 'no-store, max-age=0')
        self.send_header('Pragma', 'no-cache')
        super().end_headers()

    def log_message(self, fmt, *args):  # one line per request, no timestamp noise
        sys.stderr.write('  %s\n' % (fmt % args))


def is_free(port):
    with socket.socket() as s:
        s.setsockopt(socket.SOL_SOCKET, socket.SO_REUSEADDR, 1)
        try:
            s.bind(('127.0.0.1', port))
            return True
        except OSError:
            return False


def already_serving_the_game(port):
    """Is the thing on this port this same game? Then there is nothing to do."""
    try:
        with urllib.request.urlopen(f'http://127.0.0.1:{port}/index.html', timeout=1.5) as r:
            return TITLE in r.read(4096).decode('utf-8', 'replace')
    except (urllib.error.URLError, OSError, UnicodeError):
        return False


def main():
    os.chdir(os.path.dirname(os.path.abspath(__file__)))
    wanted = int(sys.argv[1]) if len(sys.argv) > 1 else 8000

    if not is_free(wanted):
        if already_serving_the_game(wanted):
            print(f'{TITLE} is already being served on port {wanted}.')
            print(f'Just open  http://localhost:{wanted}')
            print('(That server is a different process — this one is not needed.)')
            return
        print(f'Port {wanted} is busy with something else; looking for a free one…')

    for port in range(wanted, wanted + PORT_TRIES):
        if not is_free(port):
            continue
        try:
            server = ThreadingHTTPServer(('127.0.0.1', port), NoCacheHandler)
        except OSError:
            continue  # taken in the moment between the check and the bind
        print(f'{TITLE}  →  http://localhost:{port}')
        print('(ctrl-C to stop)')
        try:
            server.serve_forever()
        except KeyboardInterrupt:
            print('\nstopped')
        return

    sys.exit(f'No free port between {wanted} and {wanted + PORT_TRIES - 1}. '
             f'Try:  python3 serve.py 9000')


if __name__ == '__main__':
    main()
