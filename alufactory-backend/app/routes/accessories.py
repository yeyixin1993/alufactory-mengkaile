from flask import Blueprint, jsonify

from app.accessory_inventory import public_accessory_stock, seed_accessory_inventory


accessory_bp = Blueprint('accessories', __name__, url_prefix='/api/accessories')


@accessory_bp.route('/inventory', methods=['GET'])
def get_accessory_inventory():
    """Public silver-white finished-accessory availability in piece counts."""
    seed_accessory_inventory()
    return jsonify({'inventory': public_accessory_stock()}), 200
