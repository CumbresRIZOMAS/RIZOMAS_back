"""Importa perfiles y provisiona Auth solo para identidades telefónicas inequívocas."""
import json
import math
import os
import re
import subprocess
import sys
import tempfile
import zipfile
import xml.etree.ElementTree as ET
from pathlib import Path

ROOT = Path(__file__).resolve().parents[2]
BOOK = ROOT / 'REGISTROS SOFTWARE.xlsx'
BACK = Path(__file__).resolve().parents[1]
NS = {'m': 'http://schemas.openxmlformats.org/spreadsheetml/2006/main'}
KML_NS = '{http://www.opengis.net/kml/2.2}'


def col(ref):
    return re.match(r'[A-Z]+', ref).group(0)


def decimal_dms(value, positive, negative):
    text = str(value or '').strip().upper()
    direction = next((char for char in text if char in 'NSEOW'), None)
    if direction not in (positive, negative):
        return None
    parts = [float(part.replace(',', '.')) for part in re.findall(r'\d+(?:[.,]\d+)?', text)]
    if not parts or len(parts) > 3:
        return None
    degrees, minutes, seconds = (parts + [0, 0])[:3]
    if minutes >= 60 or seconds >= 60:
        return None
    result = degrees + minutes / 60 + seconds / 3600
    if result > (90 if positive == 'N' else 180):
        return None
    return -result if direction == negative else result


def haversine_meters(first, second):
    radius = 6_371_000
    lat1, lon1 = map(math.radians, first)
    lat2, lon2 = map(math.radians, second)
    delta_lat, delta_lon = lat2 - lat1, lon2 - lon1
    a = math.sin(delta_lat / 2) ** 2 + math.cos(lat1) * math.cos(lat2) * math.sin(delta_lon / 2) ** 2
    return radius * 2 * math.asin(math.sqrt(a))


def read_kml_farms():
    path = ROOT / 'FINCAS.kml'
    if not path.exists():
        return []
    root = ET.parse(path).getroot()
    result = []
    for placemark in root.findall(f'.//{KML_NS}Placemark'):
        name = (placemark.findtext(f'{KML_NS}name') or '').strip()
        coordinate = placemark.find(f'.//{KML_NS}Point/{KML_NS}coordinates')
        if not name or coordinate is None or not coordinate.text:
            continue
        values = coordinate.text.strip().split(',')
        if len(values) < 2:
            continue
        try:
            result.append({'name': name, 'latitude': float(values[1]), 'longitude': float(values[0])})
        except ValueError:
            continue
    return result


def read_rows():
    # Excel: I/J/K -> finca.region/municipality/village (vereda);
    # P -> lote.name and Q/R -> lote.latitude/longitude.
    with zipfile.ZipFile(BOOK) as book:
        shared = []
        if 'xl/sharedStrings.xml' in book.namelist():
            root = ET.fromstring(book.read('xl/sharedStrings.xml'))
            shared = [''.join(t.text or '' for t in si.findall('.//m:t', NS)) for si in root.findall('m:si', NS)]
        sheet = ET.fromstring(book.read('xl/worksheets/sheet1.xml'))
        result = []
        kml_farms = read_kml_farms()
        for xmlrow in sheet.findall('.//m:sheetData/m:row', NS)[2:]:
            values = {}
            for cell in xmlrow.findall('m:c', NS):
                value = cell.find('m:v', NS)
                text = '' if value is None else (value.text or '')
                if cell.attrib.get('t') == 's' and text:
                    text = shared[int(text)]
                if cell.attrib.get('t') == 'inlineStr':
                    text = ''.join(t.text or '' for t in cell.findall('.//m:t', NS))
                values[col(cell.attrib['r'])] = text.strip() if isinstance(text, str) else text
            name = values.get('E', '').strip()
            if not name:
                continue
            latitude = decimal_dms(values.get('Q'), 'N', 'S')
            longitude = decimal_dms(values.get('R'), 'E', 'O')
            if longitude is None:
                longitude = decimal_dms(values.get('R'), 'E', 'W')
            matched_farm = None
            if latitude is not None and longitude is not None and kml_farms:
                distances = sorted(
                    [(haversine_meters((latitude, longitude), (farm['latitude'], farm['longitude'])), farm) for farm in kml_farms],
                    key=lambda item: item[0],
                )
                # Solo vincula si hay una coincidencia cercana y claramente única.
                if distances[0][0] <= 30 and (len(distances) == 1 or distances[1][0] - distances[0][0] >= 0.5):
                    matched_farm = distances[0][1]
            result.append({
                'rowNumber': int(xmlrow.attrib['r']), 'name': name,
                'associationCode': values.get('B', ''), 'associationName': values.get('C', ''),
                'secondLevelGroup': values.get('D', ''), 'documentNumber': values.get('F', ''),
                'phone': values.get('G', ''), 'email': values.get('H', ''), 'region': values.get('I', ''),
                'municipality': values.get('J', ''), 'village': values.get('K', ''),
                'sex': values.get('L', ''), 'age': values.get('M', ''),
                'specialGroup': values.get('N', ''), 'educationLevel': values.get('O', ''),
                'propertyName': values.get('P', ''),
                'latitude': latitude, 'longitude': longitude,
                'farmName': matched_farm['name'] if matched_farm else None,
                'farmLatitude': matched_farm['latitude'] if matched_farm else None,
                'farmLongitude': matched_farm['longitude'] if matched_farm else None,
            })
        return result


def main():
    if not BOOK.exists():
        raise SystemExit('No se encontró REGISTROS SOFTWARE.xlsx en la raíz del proyecto.')
    records = read_rows()
    fd, temp_path = tempfile.mkstemp(prefix='rizomas-registro-', suffix='.json')
    try:
        with os.fdopen(fd, 'w', encoding='utf-8') as output:
            json.dump(records, output, ensure_ascii=False)
        env = os.environ.copy()
        for line in (BACK / '.env').read_text(encoding='utf-8').splitlines():
            if '=' in line and not line.lstrip().startswith('#'):
                key, value = line.split('=', 1)
                env.setdefault(key.strip(), value.strip().strip('"').strip("'"))
        # Reemplaza el pooler transaccional por su puerto de sesión para Prisma.
        env['DATABASE_URL'] = re.sub(r':6543(/)', r':5432\1', env['DATABASE_URL'])
        env['DATABASE_URL'] = re.sub(r'([?&])pgbouncer=true&?', lambda m: '?' if m.group(1) == '?' else '', env['DATABASE_URL']).rstrip('&?')
        subprocess.run(['node', str(BACK / 'scripts' / 'importar-registro-agricultores.cjs'), temp_path], cwd=BACK, env=env, check=True)
        subprocess.run(['node', str(BACK / 'scripts' / 'crear-auth-agricultores.cjs'), temp_path], cwd=BACK, env=env, check=True)
    finally:
        try:
            os.remove(temp_path)
        except FileNotFoundError:
            pass


if __name__ == '__main__':
    try:
        main()
    except subprocess.CalledProcessError as error:
        sys.exit(error.returncode or 1)
