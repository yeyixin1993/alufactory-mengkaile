# frozen_string_literal: true

require 'sketchup.rb'
require 'json'
require 'time'

module Mengkaile
  module JsonExporter
    extend self

    VERSION = '1.0.0'
    MM_PER_INCH = 25.4
    ATTRIBUTE_DICTIONARIES = [
      'Mengkaile',
      'mengkaile',
      'LonaAluminumProfileSplitter'
    ].freeze
    PROFILE_ATTRIBUTE_KEYS = %w[variant_id variantId profile model sku].freeze
    LENGTH_AXIS_ATTRIBUTE_KEYS = %w[length_axis lengthAxis extrusion_axis].freeze

    PROFILE_VARIANTS = %w[
      1515 1515-N1 1515-N2
      2020 2020-N1 2020-N2 2020-N2-OPP 2020-N3 2020-N4-SQ 2020-N4-RD 2020R
      2040 2040-N1-20 2040-N1-40 2047 2060 20100
      3030 3030-N1 3030-N2 3030R 3060 3060-N1-60
      4040 4080
    ].freeze

    PROFILE_SECTIONS_MM = {
      '1515' => [15.0, 15.0],
      '1515-N1' => [15.0, 15.0],
      '1515-N2' => [15.0, 15.0],
      '2020' => [20.0, 20.0],
      '2020-N1' => [20.0, 20.0],
      '2020-N2' => [20.0, 20.0],
      '2020-N2-OPP' => [20.0, 20.0],
      '2020-N3' => [20.0, 20.0],
      '2020-N4-SQ' => [20.0, 20.0],
      '2020-N4-RD' => [20.0, 20.0],
      '2020R' => [20.0, 20.0],
      '2040' => [20.0, 40.0],
      '2040-N1-20' => [20.0, 40.0],
      '2040-N1-40' => [20.0, 40.0],
      '2047' => [20.0, 47.0],
      '2060' => [20.0, 60.0],
      '20100' => [20.0, 100.0],
      '3030' => [30.0, 30.0],
      '3030-N1' => [30.0, 30.0],
      '3030-N2' => [30.0, 30.0],
      '3030R' => [30.0, 30.0],
      '3060' => [30.0, 60.0],
      '3060-N1-60' => [30.0, 60.0],
      '4040' => [40.0, 40.0],
      '4080' => [40.0, 80.0]
    }.freeze

    COLOR_ALIASES = {
      'natural' => 'natural', 'silver white' => 'natural', '银白' => 'natural', '銀白' => 'natural',
      'silver' => 'silver', 'bright silver' => 'silver', '亮银色' => 'silver', '亮銀色' => 'silver',
      'red' => 'red', '中国红' => 'red', '中國紅' => 'red',
      'cola_red' => 'cola_red', '可乐红' => 'cola_red', '可樂紅' => 'cola_red',
      'sapphire_blue' => 'sapphire_blue', '宝石蓝' => 'sapphire_blue', '寶石藍' => 'sapphire_blue',
      'purple' => 'purple', '紫色' => 'purple',
      'sky_blue' => 'sky_blue', '浅青蓝' => 'sky_blue', '淺青藍' => 'sky_blue',
      'green' => 'green', '松绿' => 'green', '松綠' => 'green',
      'willow_green' => 'willow_green', '柳绿' => 'willow_green', '柳綠' => 'willow_green',
      'qingli_coffee' => 'qingli_coffee', '青骊咖' => 'qingli_coffee', '青驪咖' => 'qingli_coffee',
      'beige' => 'beige', '米白' => 'beige',
      'indigo_blue' => 'indigo_blue', '黛蓝' => 'indigo_blue', '黛藍' => 'indigo_blue',
      'cool_green' => 'cool_green', '冷青绿' => 'cool_green', '冷青綠' => 'cool_green',
      'ink_green' => 'ink_green', '墨青绿' => 'ink_green', '墨青綠' => 'ink_green',
      'apple_gold' => 'apple_gold', '苹果金' => 'apple_gold', '蘋果金' => 'apple_gold',
      'olive_brown' => 'olive_brown', '橄榄棕' => 'olive_brown', '橄欖棕' => 'olive_brown',
      'lime_gold' => 'lime_gold', '青金' => 'lime_gold',
      'pink' => 'pink', '丁香粉' => 'pink',
      'coffee' => 'coffee', '摩卡咖' => 'coffee',
      'black' => 'black', '暗夜黑' => 'black',
      'british_grey' => 'british_grey', '深空灰' => 'british_grey'
    }.freeze

    FINISHES = %w[oxidized electrophoretic powder].freeze
    HOLE_TYPES = %w[through countersunk threaded].freeze
    PROFILE_SIDES = %w[A B C D].freeze
    THREAD_SIZES = %w[M3 M4 M5 M6 M8].freeze

    def composite_entity?(entity)
      entity.is_a?(Sketchup::ComponentInstance) || entity.is_a?(Sketchup::Group)
    end

    def entity_definition(entity)
      entity.respond_to?(:definition) ? entity.definition : nil
    end

    def entity_sources(entity)
      definition = entity_definition(entity)
      definition ? [entity, definition] : [entity]
    end

    def fetch_attribute(entity, keys)
      normalized_keys = keys.map { |key| key.to_s.downcase }
      entity_sources(entity).each do |source|
        ATTRIBUTE_DICTIONARIES.each do |dictionary_name|
          dictionary = source.attribute_dictionary(dictionary_name, false)
          next unless dictionary

          dictionary.each_pair do |key, value|
            return value if normalized_keys.include?(key.to_s.downcase)
          end
        end
      end
      nil
    end

    def normalize_variant(value)
      raw = value.to_s.strip.upcase.tr('×', 'X').gsub(/\s+/, '')
      return nil if raw.empty?

      exact = PROFILE_VARIANTS.find { |variant| variant.upcase == raw }
      return exact if exact

      # Only accept dimension aliases from an explicit profile attribute. Name
      # fallback below is stricter so a hole or accessory named "2020..." is
      # never exported as a physical profile.
      {
        '15X15' => '1515',
        '20X20' => '2020',
        '20X40' => '2040',
        '20X47' => '2047',
        '20X60' => '2060',
        '20X100' => '20100',
        '30X30' => '3030',
        '30X60' => '3060',
        '40X40' => '4040',
        '40X80' => '4080'
      }[raw]
    end

    def variant_from_name(entity)
      definition = entity_definition(entity)
      candidates = []
      candidates << entity.name if entity.respond_to?(:name)
      candidates << definition.name if definition && definition.respond_to?(:name)
      candidates << entity.layer.name if entity.respond_to?(:layer) && entity.layer
      candidates << entity.material.display_name if entity.respond_to?(:material) && entity.material

      PROFILE_VARIANTS.sort_by { |variant| -variant.length }.each do |variant|
        escaped = Regexp.escape(variant.upcase)
        candidates.compact.each do |candidate|
          normalized = candidate.to_s.upcase.tr('×', 'X')
          return variant if normalized.match?(/(?:^|[^A-Z0-9])(?:APS[_\-])?#{escaped}(?:$|[^A-Z0-9])/)
        end
      end
      nil
    end

    def profile_variant(entity)
      normalize_variant(fetch_attribute(entity, PROFILE_ATTRIBUTE_KEYS)) || variant_from_name(entity)
    end

    def parse_axis(value)
      case value.to_s.strip.upcase
      when 'X', '0' then 0
      when 'Y', '1' then 1
      when 'Z', '2' then 2
      end
    end

    def transform_axes(transformation)
      [transformation.xaxis, transformation.yaxis, transformation.zaxis]
    end

    def bounds_dimensions(bounds)
      [bounds.width.to_f, bounds.height.to_f, bounds.depth.to_f]
    end

    def effective_axis_dimensions_mm(bounds, transformation)
      dimensions = bounds_dimensions(bounds)
      transform_axes(transformation).each_with_index.map do |axis, index|
        dimensions[index] * axis.length.to_f * MM_PER_INCH
      end
    end

    def determine_length_axis(entity, bounds, transformation)
      explicit = parse_axis(fetch_attribute(entity, LENGTH_AXIS_ATTRIBUTE_KEYS))
      return explicit unless explicit.nil?

      dimensions = effective_axis_dimensions_mm(bounds, transformation)
      dimensions.each_index.max_by { |index| dimensions[index] }
    end

    def local_profile_point(bounds, length_axis, coordinate)
      center = bounds.center
      values = [center.x.to_f, center.y.to_f, center.z.to_f]
      values[length_axis] = coordinate.to_f
      Geom::Point3d.new(values)
    end

    def source_axis_basis(transformation, length_axis)
      axes = transform_axes(transformation)
      case length_axis
      when 0 then [axes[0], axes[1], axes[2]]
      when 1 then [axes[1], axes[2], axes[0]]
      else [axes[2], axes[0], axes[1]]
      end
    end

    # SketchUp is X/right, Y/depth, Z/up. The designer is X/width, Y/up,
    # Z/depth. Negating SketchUp Y keeps the conversion right-handed.
    def su_vector_to_designer(vector)
      [vector.x.to_f, vector.z.to_f, -vector.y.to_f]
    end

    def su_point_to_designer_mm(point)
      [
        point.x.to_f * MM_PER_INCH,
        point.z.to_f * MM_PER_INCH,
        -point.y.to_f * MM_PER_INCH
      ]
    end

    def vector_length(vector)
      Math.sqrt(vector.sum { |value| value * value })
    end

    def normalize_vector(vector)
      length = vector_length(vector)
      raise ArgumentError, '零长度坐标轴' if length < 1.0e-9

      vector.map { |value| value / length }
    end

    def dot(left, right)
      left.each_index.sum { |index| left[index] * right[index] }
    end

    def subtract(left, right)
      left.each_index.map { |index| left[index] - right[index] }
    end

    def multiply(vector, scalar)
      vector.map { |value| value * scalar }
    end

    def cross(left, right)
      [
        left[1] * right[2] - left[2] * right[1],
        left[2] * right[0] - left[0] * right[2],
        left[0] * right[1] - left[1] * right[0]
      ]
    end

    def orthonormal_basis(raw_basis)
      x_axis = normalize_vector(raw_basis[0])
      y_seed = normalize_vector(raw_basis[1])
      y_axis = normalize_vector(subtract(y_seed, multiply(x_axis, dot(y_seed, x_axis))))
      z_axis = normalize_vector(cross(x_axis, y_axis))
      expected_z = normalize_vector(raw_basis[2])
      if dot(z_axis, expected_z).negative?
        y_axis = multiply(y_axis, -1.0)
        z_axis = normalize_vector(cross(x_axis, y_axis))
      end
      [x_axis, y_axis, z_axis]
    end

    def radians_to_degrees(value)
      value * 180.0 / Math::PI
    end

    def normalize_angle(value)
      normalized = ((value + 180.0) % 360.0) - 180.0
      snapped = (normalized / 90.0).round * 90.0
      normalized = snapped if (normalized - snapped).abs < 0.01
      normalized.abs < 0.0005 ? 0.0 : normalized.round(3)
    end

    # Matches THREE.Euler#setFromRotationMatrix(matrix, 'XYZ'). The three
    # basis vectors are the world-space columns of the designer item matrix.
    def basis_to_three_euler_degrees(basis)
      x_axis, y_axis, z_axis = basis
      m11 = x_axis[0]
      m12 = y_axis[0]
      m13 = z_axis[0]
      m22 = y_axis[1]
      m23 = z_axis[1]
      m32 = y_axis[2]
      m33 = z_axis[2]

      y_angle = Math.asin([[-1.0, m13].max, 1.0].min)
      if m13.abs < 0.9999999
        x_angle = Math.atan2(-m23, m33)
        z_angle = Math.atan2(-m12, m11)
      else
        x_angle = Math.atan2(m32, m22)
        z_angle = 0.0
      end

      [x_angle, y_angle, z_angle].map do |angle|
        normalize_angle(radians_to_degrees(angle))
      end
    end

    def boolean_attribute(entity, keys)
      value = fetch_attribute(entity, keys)
      return value if value == true || value == false

      %w[1 true yes y 是].include?(value.to_s.strip.downcase)
    end

    def color_id(entity)
      raw = fetch_attribute(entity, %w[color_id colorId color])
      raw ||= entity.material.display_name if entity.respond_to?(:material) && entity.material
      COLOR_ALIASES[raw.to_s.strip.downcase] || COLOR_ALIASES[raw.to_s.strip] || 'natural'
    end

    def finish_id(entity, selected_color)
      raw = fetch_attribute(entity, %w[finish surface_finish]).to_s.strip.downcase
      return raw if FINISHES.include?(raw)

      selected_color == 'natural' ? 'oxidized' : 'powder'
    end

    def parse_holes(entity, length_mm, item_id, warnings)
      raw = fetch_attribute(entity, %w[holes_json holesJson holes])
      return [] if raw.nil? || raw.to_s.strip.empty?

      parsed = raw.is_a?(Array) ? raw : JSON.parse(raw.to_s)
      unless parsed.is_a?(Array)
        warnings << "#{item_id} 的 holes_json 不是数组，已忽略。"
        return []
      end

      parsed.each_with_index.filter_map do |hole, index|
        unless hole.is_a?(Hash)
          warnings << "#{item_id} 的第 #{index + 1} 个孔不是对象，已忽略。"
          next
        end
        side = (hole['side'] || hole[:side]).to_s.upcase
        type = (hole['type'] || hole[:type]).to_s.downcase
        position = (hole['positionMm'] || hole[:positionMm]).to_f
        groove = hole['physicalGrooveIndex'] || hole[:physicalGrooveIndex] || 0
        thread = (hole['threadSize'] || hole[:threadSize]).to_s.upcase
        unless PROFILE_SIDES.include?(side) && HOLE_TYPES.include?(type) && position >= 5.0 && position <= length_mm - 5.0
          warnings << "#{item_id} 的第 #{index + 1} 个孔超出允许范围或缺少面/类型，已忽略。"
          next
        end
        result = {
          'id' => "#{item_id}-hole-#{format('%02d', index + 1)}",
          'side' => side,
          'type' => type,
          'positionMm' => position.round(1),
          'physicalGrooveIndex' => [groove.to_i, 0].max
        }
        result['threadSize'] = thread if THREAD_SIZES.include?(thread)
        result
      end
    rescue JSON::ParserError
      warnings << "#{item_id} 的 holes_json 无法解析，已忽略全部孔位。"
      []
    end

    def bbox_designer_points(bounds, transformation)
      (0..7).map do |corner_index|
        su_point_to_designer_mm(transformation * bounds.corner(corner_index))
      end
    end

    def section_warning(variant, dimensions_mm, length_axis, item_id)
      expected = PROFILE_SECTIONS_MM[variant]
      return nil unless expected

      actual = dimensions_mm.each_with_index.reject { |_, index| index == length_axis }.map(&:first).sort
      expected = expected.sort
      mismatch = actual.each_index.any? { |index| (actual[index] - expected[index]).abs > 0.8 }
      return nil unless mismatch

      "#{item_id} 标记为 #{variant}，但实际截面约为 #{actual.map { |v| v.round(1) }.join('×')}mm；请检查是否误缩放截面。"
    end

    def safe_entity_label(entity)
      definition = entity_definition(entity)
      label = entity.respond_to?(:name) ? entity.name.to_s.strip : ''
      label = definition.name.to_s.strip if label.empty? && definition
      label.empty? ? entity.typename : label
    end

    def entity_persistent_id(entity, fallback)
      if entity.respond_to?(:persistent_id) && entity.persistent_id.to_i.positive?
        entity.persistent_id.to_i
      else
        fallback
      end
    end

    def profile_record(entity, transformation, path, persistent_path, index, warnings)
      variant = profile_variant(entity)
      return nil unless variant

      definition = entity_definition(entity)
      return nil unless definition

      bounds = definition.bounds
      length_axis = determine_length_axis(entity, bounds, transformation)
      dimensions_mm = effective_axis_dimensions_mm(bounds, transformation)
      instance_key = (persistent_path + [entity_persistent_id(entity, index + 1)]).join('-')
      item_id = "profile-su-#{instance_key}"
      length_mm = dimensions_mm[length_axis].round(1)
      if length_mm < 21.0 || length_mm > 3000.0
        warnings << "#{item_id}（#{path.join(' / ')}）长度 #{length_mm}mm 超出 21–3000mm，仍导出供设计器复核。"
      end

      mismatch = section_warning(variant, dimensions_mm, length_axis, item_id)
      warnings << mismatch if mismatch

      bounds_min = [bounds.min.x, bounds.min.y, bounds.min.z][length_axis]
      bounds_max = [bounds.max.x, bounds.max.y, bounds.max.z][length_axis]
      start_point = transformation * local_profile_point(bounds, length_axis, bounds_min)
      end_point = transformation * local_profile_point(bounds, length_axis, bounds_max)
      start_designer = su_point_to_designer_mm(start_point)
      end_designer = su_point_to_designer_mm(end_point)
      center = start_designer.each_index.map do |axis_index|
        ((start_designer[axis_index] + end_designer[axis_index]) / 2.0).round(1)
      end

      raw_basis = source_axis_basis(transformation, length_axis).map { |axis| su_vector_to_designer(axis) }
      handedness = dot(cross(normalize_vector(raw_basis[0]), normalize_vector(raw_basis[1])), normalize_vector(raw_basis[2]))
      if handedness.negative?
        warnings << "#{item_id} 使用了镜像变换；JSON 只能保存旋转，已按最接近的右手朝向导出，请重点检查封边/封槽面的方向。"
      end
      rotation = basis_to_three_euler_degrees(orthonormal_basis(raw_basis))
      selected_color = color_id(entity)
      user_remark = fetch_attribute(entity, %w[remark note description]).to_s.strip
      source_remark = "SketchUp｜#{path.join(' / ')}｜原规格#{variant}"
      remark = user_remark.empty? ? source_remark : "#{source_remark}｜#{user_remark}"

      item = {
        'id' => item_id,
        'kind' => 'profile',
        'name' => variant,
        'variantId' => variant,
        'position' => center,
        'rotation' => rotation,
        'length' => length_mm,
        'colorId' => selected_color,
        'finish' => finish_id(entity, selected_color),
        'quantity' => 1,
        'holes' => [],
        'tappingLeft' => boolean_attribute(entity, %w[tapping_left tappingLeft]),
        'tappingRight' => boolean_attribute(entity, %w[tapping_right tappingRight]),
        'remark' => remark
      }
      item['holes'] = parse_holes(entity, length_mm, item_id, warnings)
      {
        item: item,
        bounds_points: bbox_designer_points(bounds, transformation)
      }
    rescue StandardError => error
      warnings << "无法导出 #{path.join(' / ')}：#{error.message}"
      nil
    end

    def walk_entities(entities, parent_transformation, path, persistent_path, records, warnings)
      entities.each do |entity|
        next unless composite_entity?(entity)

        transformation = parent_transformation * entity.transformation
        label = safe_entity_label(entity)
        child_path = path + [label]
        entity_key = entity_persistent_id(entity, records.length + 1)
        record = profile_record(
          entity,
          transformation,
          child_path,
          persistent_path,
          records.length,
          warnings
        )
        if record
          records << record
        else
          definition = entity_definition(entity)
          if definition
            walk_entities(
              definition.entities,
              transformation,
              child_path,
              persistent_path + [entity_key],
              records,
              warnings
            )
          end
        end
      end
    end

    def translate_records_to_origin(records)
      all_points = records.flat_map { |record| record[:bounds_points] }
      minima = (0..2).map { |axis| all_points.map { |point| point[axis] }.min || 0.0 }
      records.each do |record|
        record[:item]['position'] = record[:item]['position'].each_index.map do |axis|
          (record[:item]['position'][axis] - minima[axis]).round(1)
        end
      end
      minima.map { |value| value.round(1) }
    end

    def collect_document(model)
      records = []
      warnings = []
      walk_entities(model.entities, Geom::Transformation.new, [], [], records, warnings)
      origin_shift = records.empty? ? [0.0, 0.0, 0.0] : translate_records_to_origin(records)
      items = records.map { |record| record[:item] }

      {
        'format' => 'mengkaile-diy',
        'schemaVersion' => 2,
        'savedAt' => Time.now.utc.iso8601,
        'coordinateUnit' => 'mm',
        'source' => {
          'application' => 'SketchUp',
          'exporter' => 'MengkaileJsonExporter',
          'exporterVersion' => VERSION,
          'modelName' => File.basename(model.path.to_s.empty? ? 'Untitled.skp' : model.path.to_s),
          'axisConversion' => 'SketchUp X/Y/Z -> Mengkaile X/Z/-Y basis; output X=width, Y=height, Z=depth',
          'originShiftMm' => origin_shift
        },
        'sourceSummary' => "由 SketchUp 导出：#{items.length} 根已识别型材；每个组件实例对应一个 quantity=1 的可编辑零件。",
        'warnings' => warnings,
        'grooveConvention' => {
          'sourceOfTruth' => 'physicalGrooveIndex',
          'canonicalFaces' => %w[A B],
          'mirroredDrawingFaces' => %w[C D]
        },
        'items' => items
      }
    end

    def default_export_name(model)
      base = model.path.to_s.empty? ? 'mengkaile-sketchup-design' : File.basename(model.path, '.*')
      "#{base}-mengkaile.json"
    end

    def export_model
      model = Sketchup.active_model
      document = collect_document(model)
      if document['items'].empty?
        UI.messagebox(
          '没有找到已识别的萌开了型材。\n\n' \
          '请使用带 LonaAluminumProfileSplitter/profile 属性的型材组件，' \
          '或先用“标记选中对象为萌开了型材”。'
        )
        return
      end

      path = UI.savepanel('导出萌开了设计器 JSON', nil, default_export_name(model))
      return unless path

      path += '.json' unless File.extname(path).downcase == '.json'
      File.open(path, 'wb') { |file| file.write(JSON.pretty_generate(document)) }
      warning_text = document['warnings'].empty? ? '自检未发现警告。' : "有 #{document['warnings'].length} 条复核警告，请在 JSON warnings 和设计器备注中确认。"
      UI.messagebox("已导出 #{document['items'].length} 根型材。\n#{warning_text}\n\n#{path}")
    rescue StandardError => error
      UI.messagebox("导出失败：#{error.message}")
    end

    def mark_selection
      model = Sketchup.active_model
      targets = model.selection.select { |entity| composite_entity?(entity) }
      if targets.empty?
        UI.messagebox('请先选择一个或多个型材组件/群组。')
        return
      end

      prompts = ['型材型号', '颜色', '表面工艺', '长度轴（AUTO/X/Y/Z）']
      defaults = ['2020', 'natural', 'oxidized', 'AUTO']
      lists = [PROFILE_VARIANTS.join('|'), COLOR_ALIASES.values.uniq.join('|'), FINISHES.join('|'), 'AUTO|X|Y|Z']
      values = UI.inputbox(prompts, defaults, lists, '标记为萌开了型材')
      return unless values

      variant = normalize_variant(values[0])
      unless variant
        UI.messagebox("不支持的型材型号：#{values[0]}")
        return
      end

      color = COLOR_ALIASES[values[1].to_s.strip.downcase] || values[1].to_s.strip
      finish = values[2].to_s.strip.downcase
      axis = values[3].to_s.strip.upcase
      model.start_operation('标记萌开了型材', true)
      targets.each do |entity|
        entity.set_attribute('Mengkaile', 'variant_id', variant)
        entity.set_attribute('Mengkaile', 'color_id', color)
        entity.set_attribute('Mengkaile', 'finish', FINISHES.include?(finish) ? finish : 'oxidized')
        if axis == 'AUTO'
          entity.delete_attribute('Mengkaile', 'length_axis')
        else
          entity.set_attribute('Mengkaile', 'length_axis', axis)
        end
      end
      model.commit_operation
      UI.messagebox("已标记 #{targets.length} 个对象为 #{variant}。")
    rescue StandardError => error
      model.abort_operation if model
      UI.messagebox("标记失败：#{error.message}")
    end

    def show_check
      document = collect_document(Sketchup.active_model)
      lines = ["识别型材：#{document['items'].length} 根", "警告：#{document['warnings'].length} 条"]
      lines.concat(document['warnings'].first(12))
      lines << '其余警告请导出后查看 JSON。' if document['warnings'].length > 12
      UI.messagebox(lines.join("\n"))
    end

    unless file_loaded?(__FILE__)
      menu = UI.menu('Extensions').add_submenu('萌开了')
      menu.add_item('检查当前模型…') { show_check }
      menu.add_item('标记选中对象为萌开了型材…') { mark_selection }
      menu.add_separator
      menu.add_item('导出设计器 JSON…') { export_model }
      file_loaded(__FILE__)
    end
  end
end
