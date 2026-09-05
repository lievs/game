extends Node3D

# Neon Ronin — vertical-scroll cyber-samurai roguelite.
# Hold anywhere on screen: the ronin auto-advances up the tower and you steer
# left/right to dodge. Release: he stops dead and slashes everything in reach.

const SAVE_PATH := "user://neon_ronin_save.cfg"

const ARENA_HALF_WIDTH := 5.0
const FORWARD_RUN_SPEED := 6.0
const STEER_GAIN := 8.0
const STOP_DECEL := 30.0
const FLOOR_DISTANCE := 36.0
const SPAWN_AHEAD := -34.0
const DESPAWN_BEHIND := 6.0
const CONTACT_RADIUS := 1.15
const FRAGMENT_RADIUS := 1.4
const TURRET_ENGAGE_Z := -10.0
const PROJECTILE_SPEED := 9.0

enum State { MENU, IMPLANTS, PLAYING, GAMEOVER }

const IMPLANT_ORDER := ["chassis", "blade", "servo", "magnet", "core"]
const IMPLANT_DEFS := {
	"chassis": {"name": "Усиленный корпус", "desc": "+1 очко прочности", "max": 3, "base_cost": 5},
	"blade": {"name": "Расширенный клинок", "desc": "+радиус удара катаной", "max": 4, "base_cost": 4},
	"servo": {"name": "Сервопривод", "desc": "+скорость бега и манёвра", "max": 4, "base_cost": 4},
	"magnet": {"name": "Магнит осколков", "desc": "+доход осколков данных", "max": 3, "base_cost": 6},
	"core": {"name": "Стабилизатор ядра", "desc": "+время неуязвимости", "max": 3, "base_cost": 5},
}

const LORE_LINES := [
	"...ошибка_подключения... я — страж башни. Модель KR-9.",
	"Обрывок лога: «периметр защищён, доложить...» Кому?",
	"Голос из архива: «Ветрова, отключите ядро — оно заражено».",
	"Я помню дождь. И крик. Чей был этот крик?",
	"Файл повреждён: [СЕТЬ АНДРОИДОВ] [КРИТИЧЕСКАЯ ОШИБКА] [ЭТАЖ 40]",
	"Это не вирус. Это приказ. Кто-то отдал команду «зачистить».",
	"Я узнаю этот голос... это мой создатель?",
	"Ядро башни близко. Ещё немного — и я узнаю правду.",
	"Источник команды: «ADMINISTRATOR KAITO-0». Это... я?",
	"Последний фрагмент повреждён безвозвратно. Придётся дойти до верха.",
]

var total_shards := 0
var implants := {"chassis": 0, "blade": 0, "servo": 0, "magnet": 0, "core": 0}

var state: int = State.MENU

var player: CharacterBody3D
var player_body_mat: StandardMaterial3D
var katana: MeshInstance3D
var camera: Camera3D
var floor_node: CSGBox3D
var grid_lines: Array = []

var enemies: Array = []
var projectiles: Array = []
var fragments: Array = []

var run_active := false
var floor_num := 0
var score := 0
var run_shards := 0
var hp := 3
var max_hp := 3
var attack_radius := 4.0
var run_speed := FORWARD_RUN_SPEED
var steer_speed := 10.0
var shard_mult := 1.0
var invuln_duration := 1.0
var invuln_timer := 0.0
var lore_index := 0

var is_running := false
var target_x := 0.0
var spawn_timer := 0.0

var hud: CanvasLayer
var floor_label: Label
var score_label: Label
var hp_label: Label
var shards_label: Label
var subtitle_label: Label
var subtitle_timer := 0.0
var toast_label: Label
var toast_timer := 0.0

var menu_panel: Control
var menu_shards_label: Label
var implants_panel: Control
var implants_list: VBoxContainer
var implants_back_target: int = State.MENU
var gameover_panel: Control
var gameover_stats_label: Label


func _ready() -> void:
	randomize()
	_load_meta()
	_build_environment()
	_build_arena()
	_build_player()
	_build_hud()
	_show_menu()


# ===================== Persistence =====================

func _load_meta() -> void:
	var cfg := ConfigFile.new()
	if cfg.load(SAVE_PATH) == OK:
		total_shards = cfg.get_value("meta", "shards", 0)
		for key in IMPLANT_ORDER:
			implants[key] = cfg.get_value("meta", key, 0)


func _save_meta() -> void:
	var cfg := ConfigFile.new()
	cfg.set_value("meta", "shards", total_shards)
	for key in IMPLANT_ORDER:
		cfg.set_value("meta", key, implants[key])
	cfg.save(SAVE_PATH)


# ===================== World setup =====================

func _build_environment() -> void:
	var env := Environment.new()
	env.background_mode = Environment.BG_COLOR
	env.background_color = Color(0.01, 0.01, 0.03)
	env.glow_enabled = true
	env.glow_intensity = 2.2
	env.glow_strength = 1.0
	env.glow_bloom = 0.4
	env.glow_hdr_threshold = 0.4
	env.fog_enabled = true
	env.fog_light_color = Color(0.05, 0.02, 0.12)
	env.fog_density = 0.02

	var world_env := WorldEnvironment.new()
	world_env.environment = env
	add_child(world_env)

	camera = Camera3D.new()
	camera.name = "Camera3D"
	add_child(camera)
	camera.rotation_degrees = Vector3(-58, 0, 0)

	var light := DirectionalLight3D.new()
	light.name = "Sun"
	add_child(light)
	light.rotation_degrees = Vector3(-55, 30, 0)
	light.light_energy = 0.5
	light.light_color = Color(0.6, 0.7, 1.0)


func _build_arena() -> void:
	floor_node = CSGBox3D.new()
	floor_node.name = "Floor"
	add_child(floor_node)
	floor_node.size = Vector3(ARENA_HALF_WIDTH * 2.0 + 2.0, 1.0, 200.0)
	floor_node.position = Vector3(0, -0.5, 0)
	var floor_mat := StandardMaterial3D.new()
	floor_mat.albedo_color = Color(0.03, 0.03, 0.08)
	floor_node.material = floor_mat

	var line_mat := StandardMaterial3D.new()
	line_mat.albedo_color = Color(0.1, 0.9, 1.0)
	line_mat.emission_enabled = true
	line_mat.emission = Color(0.1, 0.9, 1.0)
	line_mat.emission_energy_multiplier = 3.0

	for i in range(24):
		var line := CSGBox3D.new()
		line.size = Vector3(ARENA_HALF_WIDTH * 2.0 + 2.0, 0.02, 0.12)
		line.material = line_mat
		line.position = Vector3(0, 0.01, -float(i) * 6.0)
		add_child(line)
		grid_lines.append(line)

	for side in [-1.0, 1.0]:
		var wall_mat := StandardMaterial3D.new()
		wall_mat.albedo_color = Color(0.8, 0.1, 0.9)
		wall_mat.emission_enabled = true
		wall_mat.emission = Color(0.8, 0.1, 0.9)
		wall_mat.emission_energy_multiplier = 3.0
		var wall := CSGBox3D.new()
		wall.size = Vector3(0.15, 2.5, 200.0)
		wall.material = wall_mat
		wall.position = Vector3(side * (ARENA_HALF_WIDTH + 0.6), 0.75, 0)
		add_child(wall)


func _build_player() -> void:
	player = CharacterBody3D.new()
	player.name = "Player"
	add_child(player)
	player.position = Vector3(0, 0.5, 0)

	var p_mesh := MeshInstance3D.new()
	p_mesh.mesh = CapsuleMesh.new()
	player.add_child(p_mesh)

	var p_mat := StandardMaterial3D.new()
	p_mat.albedo_color = Color(0.0, 0.4, 1.0)
	p_mat.emission_enabled = true
	p_mat.emission = Color(0.0, 0.7, 1.0)
	p_mat.emission_energy_multiplier = 4.0
	p_mesh.material_override = p_mat
	player_body_mat = p_mat

	katana = MeshInstance3D.new()
	var sword_mesh := CylinderMesh.new()
	sword_mesh.top_radius = 0.03
	sword_mesh.bottom_radius = 0.03
	sword_mesh.height = 1.4
	katana.mesh = sword_mesh
	katana.position = Vector3(0.5, 0.0, -0.3)
	katana.rotation_degrees = Vector3(0, 0, -45)
	player.add_child(katana)

	var sword_mat := StandardMaterial3D.new()
	sword_mat.albedo_color = Color(0.7, 0.9, 1.0)
	sword_mat.emission_enabled = true
	sword_mat.emission = Color(0.7, 0.9, 1.0)
	sword_mat.emission_energy_multiplier = 5.0
	katana.material_override = sword_mat

	var p_col := CollisionShape3D.new()
	p_col.shape = CapsuleShape3D.new()
	player.add_child(p_col)


# ===================== HUD =====================

func _make_label(text: String, size: int, color: Color) -> Label:
	var l := Label.new()
	l.text = text
	l.add_theme_font_size_override("font_size", size)
	l.add_theme_color_override("font_color", color)
	l.add_theme_color_override("font_shadow_color", Color(0, 0, 0, 0.6))
	l.add_theme_constant_override("shadow_offset_x", 0)
	l.add_theme_constant_override("shadow_offset_y", 2)
	return l


func _panel_style(bg: Color, border: Color) -> StyleBoxFlat:
	var sb := StyleBoxFlat.new()
	sb.bg_color = bg
	sb.border_color = border
	sb.set_border_width_all(2)
	sb.set_corner_radius_all(16)
	sb.set_content_margin_all(22)
	return sb


func _style_button(btn: Button, accent: Color) -> void:
	btn.custom_minimum_size = Vector2(0, 52)
	btn.add_theme_font_size_override("font_size", 20)
	btn.add_theme_color_override("font_color", Color(0.02, 0.02, 0.05))
	var normal := StyleBoxFlat.new()
	normal.bg_color = accent
	normal.set_corner_radius_all(12)
	btn.add_theme_stylebox_override("normal", normal)
	var hover := StyleBoxFlat.new()
	hover.bg_color = accent.lightened(0.15)
	hover.set_corner_radius_all(12)
	btn.add_theme_stylebox_override("hover", hover)
	var pressed := StyleBoxFlat.new()
	pressed.bg_color = accent.darkened(0.15)
	pressed.set_corner_radius_all(12)
	btn.add_theme_stylebox_override("pressed", pressed)


func _build_hud() -> void:
	hud = CanvasLayer.new()
	add_child(hud)

	var top_bar := HBoxContainer.new()
	top_bar.set_anchors_preset(Control.PRESET_TOP_WIDE)
	top_bar.offset_left = 20
	top_bar.offset_right = -20
	top_bar.offset_top = 16
	top_bar.offset_bottom = 56
	top_bar.add_theme_constant_override("separation", 18)
	hud.add_child(top_bar)

	floor_label = _make_label("ЭТАЖ 1", 18, Color(0.6, 0.9, 1.0))
	score_label = _make_label("ОЧКИ 0", 18, Color(1.0, 0.85, 0.3))
	hp_label = _make_label("♥♥♥", 20, Color(1.0, 0.3, 0.4))
	shards_label = _make_label("◆ 0", 18, Color(0.9, 0.4, 1.0))
	for lbl in [floor_label, score_label, hp_label, shards_label]:
		top_bar.add_child(lbl)
		if lbl != shards_label:
			var spacer := Control.new()
			spacer.size_flags_horizontal = Control.SIZE_EXPAND_FILL
			top_bar.add_child(spacer)

	subtitle_label = _make_label("", 16, Color(0.8, 0.95, 1.0))
	subtitle_label.set_anchors_preset(Control.PRESET_CENTER_BOTTOM)
	subtitle_label.offset_top = -140
	subtitle_label.offset_bottom = -90
	subtitle_label.offset_left = -240
	subtitle_label.offset_right = 240
	subtitle_label.horizontal_alignment = HORIZONTAL_ALIGNMENT_CENTER
	subtitle_label.autowrap_mode = TextServer.AUTOWRAP_WORD
	subtitle_label.modulate.a = 0.0
	hud.add_child(subtitle_label)

	toast_label = _make_label("", 26, Color(1.0, 1.0, 1.0))
	toast_label.set_anchors_preset(Control.PRESET_CENTER_TOP)
	toast_label.offset_top = 70
	toast_label.offset_bottom = 110
	toast_label.offset_left = -160
	toast_label.offset_right = 160
	toast_label.horizontal_alignment = HORIZONTAL_ALIGNMENT_CENTER
	toast_label.modulate.a = 0.0
	hud.add_child(toast_label)

	_build_menu_panel()
	_build_implants_panel()
	_build_gameover_panel()


func _build_menu_panel() -> void:
	menu_panel = Control.new()
	menu_panel.set_anchors_preset(Control.PRESET_FULL_RECT)
	var dim := ColorRect.new()
	dim.color = Color(0.02, 0.01, 0.06, 0.85)
	dim.set_anchors_preset(Control.PRESET_FULL_RECT)
	menu_panel.add_child(dim)
	hud.add_child(menu_panel)

	var box := VBoxContainer.new()
	box.set_anchors_preset(Control.PRESET_CENTER)
	box.custom_minimum_size = Vector2(320, 0)
	box.add_theme_constant_override("separation", 12)
	menu_panel.add_child(box)
	box.position -= Vector2(160, 140)

	var title := _make_label("НЕОНОВЫЙ РОНИН", 30, Color(0.1, 0.95, 1.0))
	title.horizontal_alignment = HORIZONTAL_ALIGNMENT_CENTER
	box.add_child(title)

	var sub := _make_label("Держи экран — беги и уклоняйся.\nОтпусти — руби катаной.", 15, Color(0.75, 0.75, 0.9))
	sub.horizontal_alignment = HORIZONTAL_ALIGNMENT_CENTER
	sub.autowrap_mode = TextServer.AUTOWRAP_WORD
	box.add_child(sub)

	menu_shards_label = _make_label("Осколки данных: ◆ 0", 15, Color(0.9, 0.4, 1.0))
	menu_shards_label.horizontal_alignment = HORIZONTAL_ALIGNMENT_CENTER
	box.add_child(menu_shards_label)

	var play_btn := Button.new()
	play_btn.text = "В БОЙ"
	_style_button(play_btn, Color(0.1, 0.95, 1.0))
	play_btn.pressed.connect(_on_play_pressed)
	box.add_child(play_btn)

	var implants_btn := Button.new()
	implants_btn.text = "ИМПЛАНТЫ"
	_style_button(implants_btn, Color(0.85, 0.4, 1.0))
	implants_btn.pressed.connect(func(): _open_implants(State.MENU))
	box.add_child(implants_btn)


func _build_implants_panel() -> void:
	implants_panel = Control.new()
	implants_panel.set_anchors_preset(Control.PRESET_FULL_RECT)
	implants_panel.visible = false
	var dim := ColorRect.new()
	dim.color = Color(0.02, 0.01, 0.06, 0.9)
	dim.set_anchors_preset(Control.PRESET_FULL_RECT)
	implants_panel.add_child(dim)
	hud.add_child(implants_panel)

	var box := VBoxContainer.new()
	box.set_anchors_preset(Control.PRESET_CENTER)
	box.custom_minimum_size = Vector2(380, 0)
	box.add_theme_constant_override("separation", 10)
	implants_panel.add_child(box)
	box.position -= Vector2(190, 220)

	var title := _make_label("КИБЕР-ИМПЛАНТЫ", 24, Color(0.85, 0.4, 1.0))
	title.horizontal_alignment = HORIZONTAL_ALIGNMENT_CENTER
	box.add_child(title)

	implants_list = VBoxContainer.new()
	implants_list.add_theme_constant_override("separation", 8)
	box.add_child(implants_list)

	var back_btn := Button.new()
	back_btn.text = "НАЗАД"
	_style_button(back_btn, Color(0.5, 0.5, 0.6))
	back_btn.pressed.connect(_on_implants_back_pressed)
	box.add_child(back_btn)


func _refresh_implants_panel() -> void:
	for child in implants_list.get_children():
		child.queue_free()

	for key in IMPLANT_ORDER:
		var def: Dictionary = IMPLANT_DEFS[key]
		var lvl: int = implants[key]
		var row := PanelContainer.new()
		row.add_theme_stylebox_override("panel", _panel_style(Color(0.08, 0.06, 0.16, 0.85), Color(0.4, 0.8, 1.0, 0.5)))
		var hb := HBoxContainer.new()
		row.add_child(hb)

		var info := VBoxContainer.new()
		info.size_flags_horizontal = Control.SIZE_EXPAND_FILL
		var name_lbl := _make_label("%s  Ур.%d/%d" % [def["name"], lvl, def["max"]], 15, Color(0.9, 0.95, 1.0))
		var desc_lbl := _make_label(def["desc"], 12, Color(0.6, 0.65, 0.8))
		info.add_child(name_lbl)
		info.add_child(desc_lbl)
		hb.add_child(info)

		var buy_btn := Button.new()
		if lvl >= def["max"]:
			buy_btn.text = "МАКС"
			buy_btn.disabled = true
			_style_button(buy_btn, Color(0.3, 0.3, 0.35))
		else:
			var cost := _implant_cost(key)
			buy_btn.text = "◆ %d" % cost
			_style_button(buy_btn, Color(0.1, 0.95, 1.0))
			buy_btn.disabled = total_shards < cost
			buy_btn.pressed.connect(_buy_implant.bind(key))
		buy_btn.custom_minimum_size = Vector2(90, 44)
		hb.add_child(buy_btn)

		implants_list.add_child(row)


func _build_gameover_panel() -> void:
	gameover_panel = Control.new()
	gameover_panel.set_anchors_preset(Control.PRESET_FULL_RECT)
	gameover_panel.visible = false
	var dim := ColorRect.new()
	dim.color = Color(0.05, 0.0, 0.02, 0.88)
	dim.set_anchors_preset(Control.PRESET_FULL_RECT)
	gameover_panel.add_child(dim)
	hud.add_child(gameover_panel)

	var box := VBoxContainer.new()
	box.set_anchors_preset(Control.PRESET_CENTER)
	box.custom_minimum_size = Vector2(320, 0)
	box.add_theme_constant_override("separation", 10)
	gameover_panel.add_child(box)
	box.position -= Vector2(160, 160)

	var title := _make_label("МОДУЛЬ ОТКЛЮЧЁН", 24, Color(1.0, 0.3, 0.4))
	title.horizontal_alignment = HORIZONTAL_ALIGNMENT_CENTER
	box.add_child(title)

	gameover_stats_label = _make_label("", 15, Color(0.85, 0.85, 0.95))
	gameover_stats_label.horizontal_alignment = HORIZONTAL_ALIGNMENT_CENTER
	box.add_child(gameover_stats_label)

	var implants_btn := Button.new()
	implants_btn.text = "ИМПЛАНТЫ"
	_style_button(implants_btn, Color(0.85, 0.4, 1.0))
	implants_btn.pressed.connect(func(): _open_implants(State.GAMEOVER))
	box.add_child(implants_btn)

	var retry_btn := Button.new()
	retry_btn.text = "ЕЩЁ РАЗ"
	_style_button(retry_btn, Color(0.1, 0.95, 1.0))
	retry_btn.pressed.connect(_on_play_pressed)
	box.add_child(retry_btn)


# ===================== State transitions =====================

func _show_menu() -> void:
	state = State.MENU
	menu_shards_label.text = "Осколки данных: ◆ %d" % total_shards
	menu_panel.visible = true
	implants_panel.visible = false
	gameover_panel.visible = false


func _open_implants(back_to: int) -> void:
	implants_back_target = back_to
	_refresh_implants_panel()
	state = State.IMPLANTS
	implants_panel.visible = true
	menu_panel.visible = false
	gameover_panel.visible = false


func _on_implants_back_pressed() -> void:
	if implants_back_target == State.GAMEOVER:
		implants_panel.visible = false
		gameover_panel.visible = true
		state = State.GAMEOVER
	else:
		_show_menu()


func _buy_implant(key: String) -> void:
	var lvl: int = implants[key]
	var def: Dictionary = IMPLANT_DEFS[key]
	if lvl >= def["max"]:
		return
	var cost := _implant_cost(key)
	if total_shards < cost:
		return
	total_shards -= cost
	implants[key] = lvl + 1
	_save_meta()
	_refresh_implants_panel()


func _implant_cost(key: String) -> int:
	var lvl: int = implants[key]
	var base: int = IMPLANT_DEFS[key]["base_cost"]
	return int(base * (lvl + 1))


func _on_play_pressed() -> void:
	_start_run()


func _start_run() -> void:
	max_hp = 3 + implants["chassis"]
	hp = max_hp
	attack_radius = 4.0 + implants["blade"] * 0.6
	run_speed = FORWARD_RUN_SPEED + implants["servo"] * 0.8
	steer_speed = 10.0 + implants["servo"] * 1.0
	shard_mult = 1.0 + implants["magnet"] * 0.25
	invuln_duration = 1.0 + implants["core"] * 0.4

	floor_num = 0
	score = 0
	run_shards = 0
	invuln_timer = 0.0
	lore_index = 0
	spawn_timer = 1.0
	is_running = false

	player.position = Vector3(0, 0.5, 0)
	player.velocity = Vector3.ZERO
	target_x = 0.0

	for e in enemies:
		if is_instance_valid(e):
			e.queue_free()
	enemies.clear()
	for p in projectiles:
		if is_instance_valid(p):
			p.queue_free()
	projectiles.clear()
	for f in fragments:
		if is_instance_valid(f):
			f.queue_free()
	fragments.clear()

	_update_hud()
	menu_panel.visible = false
	implants_panel.visible = false
	gameover_panel.visible = false
	state = State.PLAYING
	run_active = true


func _end_run() -> void:
	run_active = false
	state = State.GAMEOVER
	total_shards += run_shards
	_save_meta()
	gameover_stats_label.text = "Очки: %d\nЭтаж: %d\nОсколки за забег: ◆ %d" % [score, floor_num + 1, run_shards]
	gameover_panel.visible = true


# ===================== Input =====================

func _input(event: InputEvent) -> void:
	if state != State.PLAYING:
		return

	if event is InputEventScreenTouch or event is InputEventMouseButton:
		if event.pressed:
			is_running = true
			_update_target(event.position)
		else:
			is_running = false
			_attack()
	elif event is InputEventScreenDrag or event is InputEventMouseMotion:
		if is_running:
			_update_target(event.position)


func _update_target(screen_pos: Vector2) -> void:
	var vw: float = get_viewport().get_visible_rect().size.x
	var frac: float = clamp(screen_pos.x / max(vw, 1.0), 0.0, 1.0)
	target_x = (frac * 2.0 - 1.0) * ARENA_HALF_WIDTH


# ===================== Combat =====================

func _attack() -> void:
	var hit_anything := false
	var i := enemies.size() - 1
	while i >= 0:
		var e = enemies[i]
		if is_instance_valid(e) and player.position.distance_to(e.position) <= attack_radius:
			_destroy_enemy(e, i)
			hit_anything = true
		i -= 1

	i = projectiles.size() - 1
	while i >= 0:
		var pr = projectiles[i]
		if is_instance_valid(pr) and player.position.distance_to(pr.position) <= attack_radius:
			pr.queue_free()
			projectiles.remove_at(i)
			hit_anything = true
		i -= 1

	_spawn_shockwave()
	if hit_anything:
		_flash_katana()


func _destroy_enemy(e: Node3D, index: int) -> void:
	var value: int = 1 if e.get_meta("type") == "runner" else 2
	score += value
	run_shards += int(round(value * shard_mult))
	_spawn_burst(e.position, e.get_meta("color") as Color)
	e.queue_free()
	enemies.remove_at(index)
	_update_hud()


func _flash_katana() -> void:
	var tw := create_tween()
	tw.tween_property(katana, "rotation_degrees:z", 60.0, 0.06)
	tw.tween_property(katana, "rotation_degrees:z", -45.0, 0.12)


func _spawn_shockwave() -> void:
	var ring := MeshInstance3D.new()
	var mesh := CylinderMesh.new()
	mesh.top_radius = 1.0
	mesh.bottom_radius = 1.0
	mesh.height = 0.05
	ring.mesh = mesh
	var mat := StandardMaterial3D.new()
	mat.albedo_color = Color(0.7, 0.95, 1.0, 0.5)
	mat.emission_enabled = true
	mat.emission = Color(0.7, 0.95, 1.0)
	mat.emission_energy_multiplier = 4.0
	mat.transparency = BaseMaterial3D.TRANSPARENCY_ALPHA
	ring.material_override = mat
	ring.position = player.position
	ring.scale = Vector3(0.2, 1.0, 0.2)
	add_child(ring)
	var tw := create_tween()
	tw.tween_property(ring, "scale", Vector3(attack_radius, 1.0, attack_radius), 0.22)
	tw.tween_callback(ring.queue_free)


func _spawn_burst(pos: Vector3, color: Color) -> void:
	for n in range(6):
		var chip := MeshInstance3D.new()
		chip.mesh = BoxMesh.new()
		chip.mesh.size = Vector3(0.12, 0.12, 0.12)
		var mat := StandardMaterial3D.new()
		mat.albedo_color = color
		mat.emission_enabled = true
		mat.emission = color
		mat.emission_energy_multiplier = 4.0
		chip.material_override = mat
		chip.position = pos
		add_child(chip)
		var dir := Vector3(randf_range(-1, 1), randf_range(0.2, 1.0), randf_range(-1, 1)).normalized()
		var tw := create_tween()
		tw.set_parallel(true)
		tw.tween_property(chip, "position", pos + dir * randf_range(0.6, 1.4), 0.35)
		tw.tween_property(chip, "scale", Vector3.ZERO, 0.35)
		tw.chain().tween_callback(chip.queue_free)


func _take_damage() -> void:
	if invuln_timer > 0.0:
		return
	hp -= 1
	invuln_timer = invuln_duration
	_update_hud()
	var tw := create_tween()
	tw.tween_property(player_body_mat, "emission", Color(1.0, 0.1, 0.1), 0.08)
	tw.tween_property(player_body_mat, "emission", Color(0.0, 0.7, 1.0), 0.25)
	if hp <= 0:
		_spawn_burst(player.position, Color(0.2, 0.6, 1.0))
		_end_run()


# ===================== Spawning =====================

func _spawn_enemy(type: String) -> void:
	var enemy := CharacterBody3D.new()
	enemy.set_meta("type", type)
	var color: Color = Color(1.0, 0.15, 0.2) if type == "runner" else Color(1.0, 0.55, 0.0)
	enemy.set_meta("color", color)
	enemy.set_meta("fire_cooldown", randf_range(0.6, 1.4))
	add_child(enemy)
	enemy.position = Vector3(randf_range(-ARENA_HALF_WIDTH + 0.6, ARENA_HALF_WIDTH - 0.6), 0.5, player.position.z + SPAWN_AHEAD)

	var e_mesh := MeshInstance3D.new()
	e_mesh.mesh = SphereMesh.new()
	enemy.add_child(e_mesh)

	var e_mat := StandardMaterial3D.new()
	e_mat.albedo_color = color
	e_mat.emission_enabled = true
	e_mat.emission = color
	e_mat.emission_energy_multiplier = 4.0
	e_mesh.material_override = e_mat

	var e_col := CollisionShape3D.new()
	e_col.shape = SphereShape3D.new()
	enemy.add_child(e_col)

	enemies.append(enemy)


func _spawn_projectile(from: Vector3, dir: Vector3) -> void:
	var proj := Node3D.new()
	var mesh_inst := MeshInstance3D.new()
	mesh_inst.mesh = SphereMesh.new()
	mesh_inst.mesh.radius = 0.16
	mesh_inst.mesh.height = 0.32
	var mat := StandardMaterial3D.new()
	mat.albedo_color = Color(1.0, 0.6, 0.1)
	mat.emission_enabled = true
	mat.emission = Color(1.0, 0.6, 0.1)
	mat.emission_energy_multiplier = 5.0
	mesh_inst.material_override = mat
	proj.add_child(mesh_inst)
	proj.position = from
	proj.set_meta("dir", dir)
	add_child(proj)
	projectiles.append(proj)


func _spawn_fragment() -> void:
	var frag := Node3D.new()
	var mesh_inst := MeshInstance3D.new()
	mesh_inst.mesh = SphereMesh.new()
	mesh_inst.mesh.radius = 0.22
	mesh_inst.mesh.height = 0.44
	var mat := StandardMaterial3D.new()
	mat.albedo_color = Color(0.4, 1.0, 0.6)
	mat.emission_enabled = true
	mat.emission = Color(0.4, 1.0, 0.6)
	mat.emission_energy_multiplier = 5.0
	mesh_inst.material_override = mat
	frag.add_child(mesh_inst)
	frag.position = Vector3(randf_range(-ARENA_HALF_WIDTH + 0.6, ARENA_HALF_WIDTH - 0.6), 0.7, player.position.z + SPAWN_AHEAD)
	add_child(frag)
	fragments.append(frag)


func _toast(text: String) -> void:
	toast_label.text = text
	toast_label.modulate.a = 1.0
	toast_timer = 1.6


func _show_lore(text: String) -> void:
	subtitle_label.text = text
	subtitle_label.modulate.a = 1.0
	subtitle_timer = 4.5


# ===================== Main loop =====================

func _process(delta: float) -> void:
	camera.position = player.position + Vector3(0, 11, 8)

	if toast_timer > 0.0:
		toast_timer -= delta
		if toast_timer <= 0.0:
			toast_label.modulate.a = 0.0
	if subtitle_timer > 0.0:
		subtitle_timer -= delta
		if subtitle_timer <= 0.0:
			subtitle_label.modulate.a = 0.0

	if state == State.PLAYING:
		floor_label.text = "ЭТАЖ %d" % (floor_num + 1)
		score_label.text = "ОЧКИ %d" % score
		shards_label.text = "◆ %d" % run_shards
		hp_label.text = "♥".repeat(max(hp, 0)) + "·".repeat(max(max_hp - hp, 0))


func _physics_process(delta: float) -> void:
	if state != State.PLAYING or not run_active:
		return

	if invuln_timer > 0.0:
		invuln_timer -= delta

	if is_running:
		var steer: float = clamp((target_x - player.position.x) * STEER_GAIN, -steer_speed, steer_speed)
		player.velocity.x = steer
		player.velocity.z = -run_speed
	else:
		player.velocity.x = move_toward(player.velocity.x, 0.0, STOP_DECEL * delta * 60.0)
		player.velocity.z = move_toward(player.velocity.z, 0.0, STOP_DECEL * delta * 60.0)
	player.position.x = clamp(player.position.x, -ARENA_HALF_WIDTH + 0.4, ARENA_HALF_WIDTH - 0.4)
	player.move_and_slide()

	var new_floor := int(floor(-player.position.z / FLOOR_DISTANCE))
	if new_floor > floor_num:
		floor_num = new_floor
		_toast("ЭТАЖ %d" % (floor_num + 1))

	_recycle_grid()
	_update_enemies(delta)
	_update_projectiles(delta)
	_update_fragments()
	_update_spawning(delta)


func _recycle_grid() -> void:
	for line in grid_lines:
		if line.position.z - player.position.z > 6.0:
			line.position.z -= float(grid_lines.size()) * 6.0


func _update_enemies(delta: float) -> void:
	var i := enemies.size() - 1
	while i >= 0:
		var e: CharacterBody3D = enemies[i]
		if not is_instance_valid(e):
			enemies.remove_at(i)
			i -= 1
			continue

		var type: String = e.get_meta("type")
		if type == "runner":
			var to_player := (player.position - e.position)
			to_player.y = 0
			if to_player.length() > 0.01:
				e.velocity = to_player.normalized() * (4.5 + floor_num * 0.08)
			e.move_and_slide()
		else:
			var ahead := player.position.z - e.position.z
			if ahead < TURRET_ENGAGE_Z:
				e.velocity = Vector3(0, 0, -run_speed)
				e.move_and_slide()
			else:
				e.velocity = Vector3.ZERO
				var cooldown: float = e.get_meta("fire_cooldown") - delta
				if cooldown <= 0.0:
					var dir := (player.position - e.position)
					dir.y = 0
					if dir.length() > 0.01:
						_spawn_projectile(e.position, dir.normalized())
					cooldown = max(1.6 - floor_num * 0.05, 0.7)
				e.set_meta("fire_cooldown", cooldown)

		if invuln_timer <= 0.0 and player.position.distance_to(e.position) < CONTACT_RADIUS:
			_take_damage()
			_destroy_enemy(e, i)
			i -= 1
			continue

		if e.position.z - player.position.z > DESPAWN_BEHIND:
			e.queue_free()
			enemies.remove_at(i)
		i -= 1


func _update_projectiles(delta: float) -> void:
	var i := projectiles.size() - 1
	while i >= 0:
		var pr = projectiles[i]
		if not is_instance_valid(pr):
			projectiles.remove_at(i)
			i -= 1
			continue
		var dir: Vector3 = pr.get_meta("dir")
		pr.position += dir * PROJECTILE_SPEED * delta

		if invuln_timer <= 0.0 and player.position.distance_to(pr.position) < 0.6:
			_take_damage()
			pr.queue_free()
			projectiles.remove_at(i)
			i -= 1
			continue

		if pr.position.z - player.position.z > DESPAWN_BEHIND or pr.position.distance_to(player.position) > 40.0:
			pr.queue_free()
			projectiles.remove_at(i)
		i -= 1


func _update_fragments() -> void:
	var i := fragments.size() - 1
	while i >= 0:
		var f = fragments[i]
		if not is_instance_valid(f):
			fragments.remove_at(i)
			i -= 1
			continue
		f.rotate_y(0.05)
		if player.position.distance_to(f.position) < FRAGMENT_RADIUS:
			if lore_index < LORE_LINES.size():
				_show_lore(LORE_LINES[lore_index])
				lore_index += 1
			f.queue_free()
			fragments.remove_at(i)
		elif f.position.z - player.position.z > DESPAWN_BEHIND:
			f.queue_free()
			fragments.remove_at(i)
		i -= 1


func _update_spawning(delta: float) -> void:
	spawn_timer -= delta
	if spawn_timer > 0.0:
		return
	spawn_timer = max(2.0 - floor_num * 0.06, 0.85)

	var turret_chance: float = min(0.15 + floor_num * 0.03, 0.55)
	_spawn_enemy("turret" if randf() < turret_chance else "runner")

	if randf() < 0.12:
		_spawn_fragment()


func _update_hud() -> void:
	score_label.text = "ОЧКИ %d" % score
	shards_label.text = "◆ %d" % run_shards
	hp_label.text = "♥".repeat(max(hp, 0)) + "·".repeat(max(max_hp - hp, 0))
