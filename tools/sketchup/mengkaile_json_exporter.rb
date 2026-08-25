# frozen_string_literal: true

require 'sketchup.rb'
require 'extensions.rb'

module Mengkaile
  module JsonExporter
    unless file_loaded?(__FILE__)
      extension = SketchupExtension.new(
        '萌开了 JSON 导出器',
        'mengkaile_json_exporter/main'
      )
      extension.description = '把 SketchUp 铝型材装配导出为萌开了 3D DIY 设计器 JSON。'
      extension.version = '1.0.0'
      extension.creator = '萌开了'
      Sketchup.register_extension(extension, true)
      file_loaded(__FILE__)
    end
  end
end

