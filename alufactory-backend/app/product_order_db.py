import os
import sqlite3
import json
import base64
import io
from datetime import datetime
from typing import Dict, List, Optional, Tuple


CATEGORY_LABELS = {
    'all': '总订单管理',
    'profile': '总订单管理',
    'pegboard': '铝合金洞洞板订单管理',
    'aluminum_plate': '铝板订单管理',
    'aluminum_frame_door': '铝框门订单管理',
    'marine_board': '海洋板订单管理',
    'calligraphy_cabinet': '宜家书法特柜子订单管理',
    'wardrobe': '衣柜订单管理',
}

TASK_PROGRESS_VALUES = ('started', 'in_progress', 'finished')


def normalize_task_progress(value: Optional[str]) -> str:
    raw = _normalize_text(value).replace('-', '_')
    if raw in ('started', 'start', 'begin', '已开始', '未开始'):
        return 'started'
    if raw in ('in_progress', 'processing', 'ongoing', '进行中'):
        return 'in_progress'
    if raw in ('finished', 'done', 'completed', '已完成'):
        return 'finished'
    return 'started'


def _build_progress_lookup_key(
    is_total_order: int,
    category_code: Optional[str],
    item_id: Optional[str],
    item_product_id: Optional[str],
    item_name: Optional[str],
) -> Tuple[int, str, str, str, str]:
    return (
        int(is_total_order or 0),
        str(category_code or ''),
        str(item_id or ''),
        str(item_product_id or ''),
        str(item_name or ''),
    )


def _load_existing_task_progress(conn: sqlite3.Connection, order_id: str) -> Dict[Tuple[int, str, str, str, str], str]:
    conn.row_factory = sqlite3.Row
    rows = conn.execute(
        '''
        SELECT is_total_order, category_code, item_id, item_product_id, item_name, task_progress
        FROM product_order_entries
        WHERE source_order_id = ?
        ''',
        (str(order_id),),
    ).fetchall()

    progress_map: Dict[Tuple[int, str, str, str, str], str] = {}
    for row in rows:
        progress_map[
            _build_progress_lookup_key(
                row['is_total_order'],
                row['category_code'],
                row['item_id'],
                row['item_product_id'],
                row['item_name'],
            )
        ] = normalize_task_progress(row['task_progress'])
    return progress_map


def _resolve_existing_task_progress(
    progress_map: Dict[Tuple[int, str, str, str, str], str],
    *,
    is_total_order: int,
    category_code: Optional[str],
    item_id: Optional[str],
    item_product_id: Optional[str],
    item_name: Optional[str],
) -> str:
    direct_key = _build_progress_lookup_key(is_total_order, category_code, item_id, item_product_id, item_name)
    if direct_key in progress_map:
        return progress_map[direct_key]

    fallback_keys = [
        _build_progress_lookup_key(is_total_order, category_code, item_id, '', ''),
        _build_progress_lookup_key(is_total_order, category_code, '', item_product_id, item_name),
        _build_progress_lookup_key(is_total_order, category_code, '', '', ''),
    ]
    for key in fallback_keys:
        if key in progress_map:
            return progress_map[key]
    return 'started'


def _normalize_text(value):
    return str(value or '').strip().lower()


def _to_positive_float(value) -> Optional[float]:
    try:
        num = float(value)
        return num if num > 0 else None
    except (TypeError, ValueError):
        return None


def _normalize_opening_side(value) -> Optional[str]:
    side = _normalize_text(value)
    if side in ('left', 'right'):
        return side
    if side in ('左', '左开'):
        return 'left'
    if side in ('右', '右开'):
        return 'right'
    return None


def _build_sketch_svg(category_code: str, width: Optional[float], height: Optional[float], opening_side: Optional[str], hinge_positions: List[float]) -> Optional[str]:
    """Build a PNG data URL sketch (stored in legacy `item_sketch_svg` column for compatibility)."""
    try:
        from PIL import Image, ImageDraw
    except Exception:
        return None

    w = max(1.0, float(width or 1.0))
    h = max(1.0, float(height or 1.0))
    ratio = w / h
    area_w = 120.0
    area_h = 80.0
    rw = area_w
    rh = rw / ratio
    if rh > area_h:
        rh = area_h
        rw = rh * ratio
    rx = 5.0 + (area_w - rw) / 2.0
    ry = 5.0 + (area_h - rh) / 2.0

    canvas_w = 130
    canvas_h = 90
    img = Image.new('RGB', (canvas_w, canvas_h), '#f8fafc')
    draw = ImageDraw.Draw(img)

    x0 = int(round(rx))
    y0 = int(round(ry))
    x1 = int(round(rx + rw))
    y1 = int(round(ry + rh))
    draw.rounded_rectangle((x0, y0, x1, y1), radius=2, fill='#ffffff', outline='#334155', width=2)

    if category_code == 'pegboard':
        for c in range(6):
            for r in range(4):
                cx = rx + ((c + 1) * rw) / 7.0
                cy = ry + ((r + 1) * rh) / 5.0
                draw.ellipse((cx - 1.4, cy - 2.0, cx + 1.4, cy + 2.0), fill='#94a3b8')

    if category_code == 'aluminum_frame_door':
        for hp in hinge_positions:
            hp_clamped = max(0.0, min(h, float(hp or 0.0)))
            hy = ry + (hp_clamped / h) * rh
            hx = rx if opening_side == 'left' else (rx + rw - 2.5)
            draw.rounded_rectangle(
                (int(round(hx)), int(round(hy - 1.2)), int(round(hx + 2.5)), int(round(hy + 1.3))),
                radius=1,
                fill='#ef4444',
            )

        handle_x = (rx + rw - 3.5) if opening_side == 'left' else (rx - 1.0)
        handle_y = ry + rh / 2.0 - 6.0
        draw.rounded_rectangle(
            (
                int(round(handle_x)),
                int(round(handle_y)),
                int(round(handle_x + 3.5)),
                int(round(handle_y + 12.0)),
            ),
            radius=1,
            fill='#2563eb',
        )

    buf = io.BytesIO()
    img.save(buf, format='PNG', optimize=True)
    encoded = base64.b64encode(buf.getvalue()).decode('ascii')
    return f'data:image/png;base64,{encoded}'


def _extract_item_detail_payload(category_code: str, item_config) -> Dict[str, Optional[str]]:
    config = item_config if isinstance(item_config, dict) else {}
    if isinstance(item_config, str):
        try:
            config = json.loads(item_config)
        except Exception:
            config = {}

    width = _to_positive_float(config.get('width'))
    height = _to_positive_float(config.get('height'))
    thickness_raw = config.get('thickness')
    thickness = str(thickness_raw).strip() if thickness_raw not in (None, '') else None
    color = str(config.get('colorName') or config.get('colorId') or '').strip() or None
    opening_side = _normalize_opening_side(config.get('openingSide'))

    hinge_positions_raw = config.get('hingePositions') if isinstance(config.get('hingePositions'), list) else []
    hinge_positions = []
    for hp in hinge_positions_raw:
        value = _to_positive_float(hp)
        if value is not None:
            hinge_positions.append(value)

    remark = str(config.get('remark') or '').strip()
    if not remark and opening_side:
        hinge_count = int(config.get('hingeCount') or len(hinge_positions) or 0)
        top_offset = _to_positive_float(config.get('topHingeOffset')) or 100
        bottom_offset = _to_positive_float(config.get('bottomHingeOffset')) or 100
        hinge_gaps = config.get('hingeGaps') if isinstance(config.get('hingeGaps'), list) else []
        gap_text = '/'.join([f"{float(g):.0f}mm" for g in hinge_gaps if _to_positive_float(g) is not None]) or '-'
        remark = f'铰链{hinge_count}个；上{top_offset:.0f}mm，下{bottom_offset:.0f}mm；间距{gap_text}'

    sketch_svg = _build_sketch_svg(category_code, width, height, opening_side, hinge_positions)

    return {
        'item_width': width,
        'item_height': height,
        'item_thickness': thickness,
        'item_color': color,
        'item_opening_side': opening_side,
        'item_remark': remark or None,
        'item_sketch_svg': sketch_svg,
    }


def classify_order_item(product_type: str, product_name: str, product_id: str) -> Optional[str]:
    ptype = _normalize_text(product_type)
    pname = _normalize_text(product_name)
    pid = _normalize_text(product_id)

    if ptype == 'profile' or '铝型材' in pname:
        return 'profile'
    if 'aluminum_plate' in ptype or '铝板' in pname or pid == 'p5':
        return 'aluminum_plate'
    if 'marine_board' in ptype or '海洋板' in pname or pid == 'p6':
        return 'marine_board'
    if 'cabinet_door' in ptype or '铝框门' in pname or pid == 'p3':
        return 'aluminum_frame_door'
    if 'calligraphy_cabinet' in ptype or '书法特柜子' in pname or '宜家书法特柜子' in pname or pid == 'p7':
        return 'calligraphy_cabinet'
    if 'wardrobe' in ptype or '衣柜' in pname or pid == 'p8':
        return 'wardrobe'
    if ptype == 'pegboard' or '洞洞板' in pname or pid == 'p1':
        return 'pegboard'
    return None


def _get_db_path(instance_path: str) -> str:
    os.makedirs(instance_path, exist_ok=True)
    return os.path.join(instance_path, 'product_orders.db')


def init_product_order_db(instance_path: str):
    db_path = _get_db_path(instance_path)
    conn = sqlite3.connect(db_path)
    try:
        conn.execute(
            '''
            CREATE TABLE IF NOT EXISTS product_order_entries (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                source_order_id TEXT NOT NULL,
                order_number TEXT,
                category_code TEXT NOT NULL,
                category_label TEXT NOT NULL,
                is_total_order INTEGER DEFAULT 0,
                user_id TEXT,
                user_name TEXT,
                user_phone TEXT,
                customer_phone TEXT,
                recipient_name TEXT,
                province TEXT,
                address_detail TEXT,
                shipping_method TEXT,
                subtotal REAL DEFAULT 0,
                shipping_fee REAL DEFAULT 0,
                total_amount REAL DEFAULT 0,
                status TEXT,
                task_progress TEXT DEFAULT 'started',
                tracking_number TEXT,
                memo TEXT,
                admin_memo TEXT,
                item_id TEXT,
                item_product_id TEXT,
                item_name TEXT,
                item_type TEXT,
                item_quantity INTEGER DEFAULT 0,
                item_unit_price REAL DEFAULT 0,
                item_total_price REAL DEFAULT 0,
                item_config TEXT,
                item_width REAL,
                item_height REAL,
                item_thickness TEXT,
                item_color TEXT,
                item_opening_side TEXT,
                item_remark TEXT,
                item_sketch_svg TEXT,
                created_at TEXT,
                updated_at TEXT,
                pdf_available INTEGER DEFAULT 0
            )
            '''
        )
        # Backward-compatible auto-upgrade for existing DBs
        existing_cols = {row[1] for row in conn.execute("PRAGMA table_info(product_order_entries)").fetchall()}
        required_cols = {
            'is_total_order': 'INTEGER DEFAULT 0',
            'item_id': 'TEXT',
            'item_product_id': 'TEXT',
            'item_name': 'TEXT',
            'item_type': 'TEXT',
            'item_quantity': 'INTEGER DEFAULT 0',
            'item_unit_price': 'REAL DEFAULT 0',
            'item_total_price': 'REAL DEFAULT 0',
            'item_config': 'TEXT',
            'item_width': 'REAL',
            'item_height': 'REAL',
            'item_thickness': 'TEXT',
            'item_color': 'TEXT',
            'item_opening_side': 'TEXT',
            'item_remark': 'TEXT',
            'item_sketch_svg': 'TEXT',
            'task_progress': "TEXT DEFAULT 'started'",
        }
        for col, col_type in required_cols.items():
            if col not in existing_cols:
                conn.execute(f'ALTER TABLE product_order_entries ADD COLUMN {col} {col_type}')
        conn.execute('CREATE INDEX IF NOT EXISTS idx_product_orders_category ON product_order_entries(category_code)')
        conn.execute('CREATE INDEX IF NOT EXISTS idx_product_orders_order_id ON product_order_entries(source_order_id)')
        conn.execute('CREATE INDEX IF NOT EXISTS idx_product_orders_status ON product_order_entries(status)')
        conn.commit()
    finally:
        conn.close()


def _delete_existing_for_order(conn: sqlite3.Connection, order_id: str):
    conn.execute('DELETE FROM product_order_entries WHERE source_order_id = ?', (order_id,))


def sync_order_snapshot(instance_path: str, order, user=None, pdf_available: bool = False):
    init_product_order_db(instance_path)
    db_path = _get_db_path(instance_path)
    items = list(getattr(order, 'items', []) or [])

    conn = sqlite3.connect(db_path)
    try:
        existing_progress_map = _load_existing_task_progress(conn, str(order.id))
        _delete_existing_for_order(conn, str(order.id))

        # 1) Total-order row (总订单)
        conn.execute(
            '''
            INSERT INTO product_order_entries (
                source_order_id, order_number, category_code, category_label, is_total_order,
                user_id, user_name, user_phone,
                customer_phone, recipient_name, province, address_detail,
                shipping_method, subtotal, shipping_fee, total_amount,
                status, task_progress, tracking_number, memo, admin_memo,
                item_id, item_product_id, item_name, item_type, item_quantity, item_unit_price, item_total_price,
                item_config,
                item_width, item_height, item_thickness, item_color, item_opening_side, item_remark, item_sketch_svg,
                created_at, updated_at, pdf_available
            ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
            ''',
            (
                str(order.id),
                getattr(order, 'order_number', ''),
                'all',
                CATEGORY_LABELS.get('all', '总订单管理'),
                1,
                getattr(order, 'user_id', ''),
                getattr(user, 'username', '') if user else '',
                getattr(user, 'phone', '') if user else '',
                getattr(order, 'phone', ''),
                getattr(order, 'recipient_name', ''),
                getattr(order, 'province', ''),
                getattr(order, 'address_detail', ''),
                getattr(order, 'shipping_method', ''),
                float(getattr(order, 'subtotal', 0) or 0),
                float(getattr(order, 'shipping_fee', 0) or 0),
                float(getattr(order, 'total_amount', 0) or 0),
                getattr(order, 'status', ''),
                _resolve_existing_task_progress(
                    existing_progress_map,
                    is_total_order=1,
                    category_code='all',
                    item_id=None,
                    item_product_id=None,
                    item_name='ALL_ITEMS',
                ),
                getattr(order, 'tracking_number', ''),
                getattr(order, 'memo', ''),
                getattr(order, 'admin_memo', ''),
                None,
                None,
                'ALL_ITEMS',
                'ALL',
                0,
                0,
                0,
                None,
                None,
                None,
                None,
                None,
                None,
                None,
                None,
                getattr(order, 'created_at', None).isoformat() if getattr(order, 'created_at', None) else None,
                getattr(order, 'updated_at', None).isoformat() if getattr(order, 'updated_at', None) else None,
                1 if pdf_available else 0,
            ),
        )

        # 2) Section-item rows (one row per item, grouped by category tabs)
        for item in items:
            category_code = classify_order_item(
                getattr(item, 'product_type', ''),
                getattr(item, 'product_name', ''),
                getattr(item, 'product_id', ''),
            )
            if category_code:
                item_qty = int(getattr(item, 'quantity', 0) or 0)
                item_total = float(getattr(item, 'total_price', 0) or 0)
                item_unit = float(getattr(item, 'unit_price', 0) or 0)
                if item_unit <= 0 and item_qty > 0:
                    item_unit = item_total / item_qty
                item_config = getattr(item, 'config', None)
                detail_payload = _extract_item_detail_payload(category_code, item_config)
                conn.execute(
                    '''
                    INSERT INTO product_order_entries (
                        source_order_id, order_number, category_code, category_label, is_total_order,
                        user_id, user_name, user_phone,
                        customer_phone, recipient_name, province, address_detail,
                        shipping_method, subtotal, shipping_fee, total_amount,
                        status, task_progress, tracking_number, memo, admin_memo,
                        item_id, item_product_id, item_name, item_type, item_quantity, item_unit_price, item_total_price,
                        item_config,
                        item_width, item_height, item_thickness, item_color, item_opening_side, item_remark, item_sketch_svg,
                        created_at, updated_at, pdf_available
                    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
                    ''',
                    (
                        str(order.id),
                        getattr(order, 'order_number', ''),
                        category_code,
                        CATEGORY_LABELS.get(category_code, category_code),
                        0,
                        getattr(order, 'user_id', ''),
                        getattr(user, 'username', '') if user else '',
                        getattr(user, 'phone', '') if user else '',
                        getattr(order, 'phone', ''),
                        getattr(order, 'recipient_name', ''),
                        getattr(order, 'province', ''),
                        getattr(order, 'address_detail', ''),
                        getattr(order, 'shipping_method', ''),
                        item_total,
                        0.0,
                        item_total,
                        getattr(order, 'status', ''),
                        _resolve_existing_task_progress(
                            existing_progress_map,
                            is_total_order=0,
                            category_code=category_code,
                            item_id=getattr(item, 'id', ''),
                            item_product_id=getattr(item, 'product_id', ''),
                            item_name=getattr(item, 'product_name', ''),
                        ),
                        getattr(order, 'tracking_number', ''),
                        getattr(order, 'memo', ''),
                        getattr(order, 'admin_memo', ''),
                        getattr(item, 'id', ''),
                        getattr(item, 'product_id', ''),
                        getattr(item, 'product_name', ''),
                        getattr(item, 'product_type', ''),
                        item_qty,
                        item_unit,
                        item_total,
                        json.dumps(item_config, ensure_ascii=False),
                        detail_payload.get('item_width'),
                        detail_payload.get('item_height'),
                        detail_payload.get('item_thickness'),
                        detail_payload.get('item_color'),
                        detail_payload.get('item_opening_side'),
                        detail_payload.get('item_remark'),
                        detail_payload.get('item_sketch_svg'),
                        getattr(order, 'created_at', None).isoformat() if getattr(order, 'created_at', None) else None,
                        getattr(order, 'updated_at', None).isoformat() if getattr(order, 'updated_at', None) else None,
                        1 if pdf_available else 0,
                    ),
                )
        conn.commit()
    finally:
        conn.close()


def update_product_order_task_progress(instance_path: str, entry_id: int, task_progress: str) -> Optional[Dict]:
    init_product_order_db(instance_path)
    db_path = _get_db_path(instance_path)
    conn = sqlite3.connect(db_path)
    conn.row_factory = sqlite3.Row
    try:
        normalized_progress = normalize_task_progress(task_progress)
        now_iso = datetime.utcnow().isoformat()
        cursor = conn.execute(
            '''
            UPDATE product_order_entries
            SET task_progress = ?, updated_at = ?
            WHERE id = ?
            ''',
            (normalized_progress, now_iso, int(entry_id)),
        )
        if cursor.rowcount <= 0:
            conn.rollback()
            return None

        row = conn.execute(
            'SELECT * FROM product_order_entries WHERE id = ?',
            (int(entry_id),),
        ).fetchone()
        conn.commit()
        return dict(row) if row else None
    finally:
        conn.close()


def remove_order_snapshot(instance_path: str, order_id: str):
    init_product_order_db(instance_path)
    db_path = _get_db_path(instance_path)
    conn = sqlite3.connect(db_path)
    try:
        _delete_existing_for_order(conn, str(order_id))
        conn.commit()
    finally:
        conn.close()


def query_order_snapshots(
    instance_path: str,
    category_code: Optional[str] = None,
    status: Optional[str] = None,
    page: int = 1,
    per_page: int = 50,
) -> Tuple[List[Dict], int]:
    init_product_order_db(instance_path)
    db_path = _get_db_path(instance_path)
    conn = sqlite3.connect(db_path)
    conn.row_factory = sqlite3.Row
    try:
        where = []
        params = []

        if category_code:
            where.append('category_code = ?')
            params.append(category_code)
        if status:
            where.append('status = ?')
            params.append(status)

        where_sql = f"WHERE {' AND '.join(where)}" if where else ''

        total_sql = f'SELECT COUNT(*) AS c FROM product_order_entries {where_sql}'
        total = conn.execute(total_sql, params).fetchone()['c']

        page = max(1, int(page or 1))
        per_page = max(1, min(200, int(per_page or 50)))
        offset = (page - 1) * per_page

        rows = conn.execute(
            f'''
            SELECT *
            FROM product_order_entries
            {where_sql}
            ORDER BY created_at DESC, id DESC
            LIMIT ? OFFSET ?
            ''',
            [*params, per_page, offset],
        ).fetchall()

        return [dict(r) for r in rows], total
    finally:
        conn.close()


def find_order_ids_with_missing_item_details(
    instance_path: str,
    category_code: Optional[str] = None,
    limit: int = 200,
) -> List[str]:
    init_product_order_db(instance_path)
    db_path = _get_db_path(instance_path)
    conn = sqlite3.connect(db_path)
    conn.row_factory = sqlite3.Row
    try:
        where = [
            'is_total_order = 0',
            '(item_config IS NOT NULL AND TRIM(item_config) <> "" AND item_config <> "null" AND ((item_width IS NULL OR item_height IS NULL) OR item_sketch_svg IS NULL OR item_sketch_svg = "" OR item_sketch_svg LIKE "<svg%"))',
        ]
        params = []
        if category_code:
            where.append('category_code = ?')
            params.append(category_code)

        sql = f'''
            SELECT DISTINCT source_order_id
            FROM product_order_entries
            WHERE {' AND '.join(where)}
            ORDER BY updated_at DESC, created_at DESC, id DESC
            LIMIT ?
        '''
        rows = conn.execute(sql, [*params, max(1, min(1000, int(limit or 200)))]).fetchall()
        return [str(r['source_order_id']) for r in rows if r['source_order_id']]
    finally:
        conn.close()
