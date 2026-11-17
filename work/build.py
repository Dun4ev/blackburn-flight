"""Assemble the local viewer. All resources used at run time live inside the HTML."""
from pathlib import Path
from base64 import b64encode
import argparse
import json
import re
import shutil
import subprocess

here = Path(__file__).resolve().parent
project = here.parent
outputs = project / 'outputs'
modules = project / 'node_modules'
npm_three = modules / 'three'
font_dir = modules / '@fontsource' / 'instrument-serif'
golos = project / 'assets' / 'fonts'

parser = argparse.ArgumentParser(description=__doc__)
parser.add_argument('model', nargs='?', type=Path, default=here / 'aircraft.glb')
parser.add_argument('destination', nargs='?', type=Path, help='HTML path (positional form)')
parser.add_argument('--output', type=Path, help='HTML path, defaults to outputs/Blackburn-Flight.html')
parser.add_argument('--site', action='store_true', help='Build the two public files in dist/ for static hosting')
args = parser.parse_args()
if args.output and args.destination:
    parser.error('Use either --output or the positional destination.')
if args.site and (args.output or args.destination):
    parser.error('Use --site by itself to build the static website.')
output = project/'dist/index.html' if args.site else args.output or args.destination or outputs/'Blackburn-Flight.html'
icons = {
    'back':'<path d="m9 5-7 7 7 7M3 12h18"/>',
    'key':'<rect x="2.5" y="5.8" width="19" height="12.5" rx="2"/><path d="M6 10h.4m3.1 0h.4m3.2 0h.4m3.2 0h.4M6 14h1m3 0h6"/>',
    'mute':'<path d="M3 9h4l5-4v14l-5-4H3zM16 9l5 6m0-6-5 6"/>',
    'full':'<path d="M4 9V4h5m6 0h5v5m0 6v5h-5m-6 0H4v-5"/>',
    'orbit':'<ellipse cx="12" cy="12" rx="10" ry="4.7" transform="rotate(-28 12 12)"/><path d="M9 17c-2.2-4.5-2.7-10-.3-11.5 2.5-1.5 6.4 2.1 8 6.8"/><circle cx="12" cy="12" r="1"/>',
    'reset':'<path d="M4 6v5h5m-4.8-.2a8 8 0 1 1 .8 5.5"/>',
    'camera':'<path d="M3 7h4l1.6-2.5h6.8L17 7h4v12H3z"/><circle cx="12" cy="12.5" r="3.4"/>',
    'pause':'<path d="M8 5v14M16 5v14" stroke-width="2.8"/>',
    'expand':'<path d="M7 17 17 7M7.5 7H17v9.5"/>',
    'arrow':'<path d="M3 12h17m-6.5-6 6 6-6 6"/>',
    'x':'<path d="m6 6 12 12M18 6 6 18"/>',
}
def enc(path): return b64encode(path.read_bytes()).decode()
font_data = []
for name, path, style, weight, mime in [
    ('Golos', golos/'GolosText.ttf', 'normal','400 900','font/ttf'),
    ('Instrument',font_dir/'files/instrument-serif-latin-400-normal.woff2','normal','400','font/woff2'),
    ('Instrument',font_dir/'files/instrument-serif-latin-400-italic.woff2','italic','400','font/woff2')
]:
    font_data.append(f"@font-face{{font-family:{name};font-style:{style};font-weight:{weight};font-display:swap;src:url(data:{mime};base64,{enc(path)})}}")
bundle_command = """
const esbuild = require('esbuild');
const build = esbuild.buildSync({
  entryPoints: ['work/main.js'],
  bundle: true,
  format: 'iife',
  target: 'es2020',
  minify: true,
  legalComments: 'inline',
  write: false,
});
process.stdout.write(build.outputFiles[0].contents);
"""
bundle = subprocess.check_output(['node', '-e', bundle_command], cwd=project).decode('utf-8')
source = (here/'page.html').read_text(encoding='utf-8')
source = re.sub(r'__I_(\w+)__',lambda m: '<svg aria-hidden="true" viewBox="0 0 24 24">'+icons[m[1]]+'</svg>',source)
lic = '\n\n'.join(x.read_text(encoding='utf-8') for x in [golos/'GolosText-OFL.txt',font_dir/'LICENSE',npm_three/'LICENSE'])
styles = [here / name for name in ('style.css', 'history.css', 'trail.css', 'mini-map.css')]
css = '\n'.join(path.read_text(encoding='utf-8') for path in styles if path.is_file())
source = source.replace('__CSS__', css).replace('__FONTS__','\n'.join(font_data))
photos = {path.relative_to(project).as_posix(): 'data:image/jpeg;base64,' + enc(path)
          for path in sorted((project / 'assets' / 'history').glob('*.jpg'))}
source = source.replace('__HISTORY_PHOTOS__', json.dumps(photos, separators=(',', ':')))
bundle = bundle.replace('</script','<\\/script')
source=source.replace('__MODEL__',enc(args.model)).replace('__BUNDLE__',bundle)
source=source.replace('</body>', '<script id="bundled-licenses" type="text/plain">'+lic+'</script>\n</body>')
output.parent.mkdir(parents=True, exist_ok=True)
output.write_bytes(source.encode('utf-8'))
if args.site:
    shutil.copyfile(project/'assets/flight-preview.jpg', output.parent/'flight-preview.jpg')
print(f'{output} · {output.stat().st_size/1000000:.2f} MB')
