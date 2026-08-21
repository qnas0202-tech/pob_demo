extends Node3D

const ENCOUNTERS := 5
const STEP_DISTANCE := 12.0

var player: Node3D
var camera: Camera3D
var hud: Label
var choice_panel: VBoxContainer
var choice_labels: Array[Label] = []
var enemy: Dictionary = {}
var state := "advance"
var encounter_index := 0
var advance_target_z := 0.0
var boss_hp := 1000.0
var boss_max_hp := 1000.0
var enemy_hp := 0.0
var enemy_max_hp := 0.0
var damage := 40.0
var attack_interval := 0.72
var attack_timer := 0.0
var enemy_attack_timer := 0.0
var resources := 0
var shake := 0.0
var rng := RandomNumberGenerator.new()
var warrior_texture: Texture2D
var archer_texture: Texture2D

func _ready() -> void:
	rng.randomize()
	warrior_texture = load("res://assets/generated/warrior.png")
	archer_texture = load("res://assets/generated/archer.png")
	Input.mouse_mode = Input.MOUSE_MODE_CAPTURED
	_build_world()
	_build_player()
	_build_ui()
	_start_advance()

func _unhandled_input(event: InputEvent) -> void:
	if event is InputEventKey and event.pressed and event.keycode == KEY_ESCAPE:
		Input.mouse_mode = Input.MOUSE_MODE_VISIBLE if Input.mouse_mode == Input.MOUSE_MODE_CAPTURED else Input.MOUSE_MODE_CAPTURED
	if state == "reward":
		if event.is_action_pressed("choose_1"):
			_take_reward(0)
		if event.is_action_pressed("choose_2"):
			_take_reward(1)
		if event.is_action_pressed("choose_3"):
			_take_reward(2)

func _process(delta: float) -> void:
	if boss_hp <= 0.0:
		state = "done"
		hud.text = "패배 - 용사가 던전 코어를 탈환했다"
		return
	if state == "advance":
		_update_advance(delta)
	elif state == "fight":
		_update_fight(delta)
	shake = max(0.0, shake - delta * 8.0)
	camera.h_offset = rng.randf_range(-shake, shake) * 0.035
	camera.v_offset = rng.randf_range(-shake, shake) * 0.035
	_update_hud()

func _build_world() -> void:
	var floor_mat := _texture_mat("res://assets/generated/floor.png", Color("#221d1b"))
	var wall_mat := _texture_mat("res://assets/generated/wall.png", Color("#4a342c"))
	for i in ENCOUNTERS:
		var z := -i * STEP_DISTANCE
		_add_kenney_room(i, z)
		_box(Vector3(0, -0.55, z), Vector3(10, 0.2, 10), floor_mat)
		_box(Vector3(-5.0, 1.2, z), Vector3(0.35, 3.3, 10), wall_mat)
		_box(Vector3(5.0, 1.2, z), Vector3(0.35, 3.3, 10), wall_mat)
		_box(Vector3(0, 1.2, z + 5.0), Vector3(10, 3.3, 0.35), wall_mat)
		_box(Vector3(0, 1.2, z - 5.0), Vector3(10, 3.3, 0.35), wall_mat)
		if i > 0:
			_add_door(Vector3(0, 1.25, z + 4.8))
	var light := DirectionalLight3D.new()
	light.light_energy = 2.4
	light.rotation_degrees = Vector3(-55, 25, 0)
	add_child(light)

func _build_player() -> void:
	player = Node3D.new()
	player.position = Vector3(0, 0, 5)
	add_child(player)
	camera = Camera3D.new()
	camera.position = Vector3(0, 1.35, 0)
	camera.fov = 72
	player.add_child(camera)

func _build_ui() -> void:
	var layer := CanvasLayer.new()
	add_child(layer)
	hud = Label.new()
	hud.position = Vector2(24, 18)
	hud.add_theme_font_size_override("font_size", 24)
	layer.add_child(hud)
	choice_panel = VBoxContainer.new()
	choice_panel.position = Vector2(340, 420)
	choice_panel.visible = false
	layer.add_child(choice_panel)
	for i in 3:
		var label := Label.new()
		label.add_theme_font_size_override("font_size", 28)
		choice_panel.add_child(label)
		choice_labels.append(label)

func _start_advance() -> void:
	state = "advance"
	choice_panel.visible = false
	advance_target_z = -encounter_index * STEP_DISTANCE

func _update_advance(delta: float) -> void:
	player.position.z = move_toward(player.position.z, advance_target_z + 2.4, delta * 4.2)
	if abs(player.position.z - (advance_target_z + 2.4)) < 0.05:
		_spawn_enemy()

func _spawn_enemy() -> void:
	state = "fight"
	enemy_max_hp = 120.0 + encounter_index * 45.0
	enemy_hp = enemy_max_hp
	var body := Node3D.new()
	body.position = Vector3(0, 0.0, advance_target_z - 2.6)
	add_child(body)
	var sprite := Sprite3D.new()
	sprite.texture = warrior_texture if encounter_index % 2 == 0 else archer_texture
	sprite.pixel_size = 0.00145
	sprite.billboard = BaseMaterial3D.BILLBOARD_ENABLED
	sprite.position = Vector3(0, 1.15, 0)
	body.add_child(sprite)
	enemy = {"body": body, "sprite": sprite, "bar": _add_hp_bar(body)}
	attack_timer = 0.25
	enemy_attack_timer = 0.95

func _update_fight(delta: float) -> void:
	attack_timer -= delta
	enemy_attack_timer -= delta
	if attack_timer <= 0.0:
		attack_timer = attack_interval
		enemy_hp -= damage
		shake = 0.12
		_flash_enemy(enemy.sprite)
		_update_enemy_bar()
	if enemy_attack_timer <= 0.0:
		enemy_attack_timer = 1.15
		boss_hp -= 38.0 + encounter_index * 8.0
		shake = max(shake, 0.09)
	if enemy_hp <= 0.0:
		enemy.body.queue_free()
		enemy = {}
		resources += 1
		if encounter_index >= ENCOUNTERS - 1:
			state = "done"
			hud.text = "승리 - 던전 자원을 회수했다"
		else:
			_show_rewards()

func _show_rewards() -> void:
	state = "reward"
	choice_panel.visible = true
	choice_labels[0].text = "1. 전리품 흡수: 자동공격 피해 +10"
	choice_labels[1].text = "2. 마력 회수: 공격 속도 +12%"
	choice_labels[2].text = "3. 코어 회복: 보스 HP +120"

func _take_reward(index: int) -> void:
	if index == 0:
		damage += 10.0
	elif index == 1:
		attack_interval = max(0.32, attack_interval * 0.88)
	else:
		boss_hp = min(boss_max_hp, boss_hp + 120.0)
	encounter_index += 1
	_start_advance()

func _update_hud() -> void:
	if state == "done":
		return
	var enemy_text := "없음" if state == "advance" or state == "reward" else "%d/%d" % [max(0, int(enemy_hp)), int(enemy_max_hp)]
	hud.text = "보스 HP %d/%d | 조우 %d/%d | 용사 HP %s | 피해 %.0f | 공속 %.2fs | 회수 자원 %d" % [
		max(0, int(boss_hp)), int(boss_max_hp), encounter_index + 1, ENCOUNTERS, enemy_text, damage, attack_interval, resources
	]

func _add_hp_bar(body: Node3D) -> Sprite3D:
	var view := Sprite3D.new()
	view.position = Vector3(0, 1.55, 0)
	view.pixel_size = 0.01
	view.billboard = BaseMaterial3D.BILLBOARD_ENABLED
	body.add_child(view)
	_update_enemy_bar_for(view)
	return view

func _update_enemy_bar() -> void:
	if enemy.is_empty():
		return
	_update_enemy_bar_for(enemy.bar)

func _update_enemy_bar_for(view: Sprite3D) -> void:
	var image := Image.create(84, 9, false, Image.FORMAT_RGBA8)
	image.fill(Color(0, 0, 0, 0.78))
	var fill_width := int(82.0 * max(0.0, enemy_hp) / max(1.0, enemy_max_hp))
	for x in range(1, 1 + fill_width):
		for y in range(1, 8):
			image.set_pixel(x, y, Color("#d84040"))
	view.texture = ImageTexture.create_from_image(image)

func _flash_enemy(sprite: Sprite3D) -> void:
	sprite.texture = _hero_texture(Color("#ffffff"), Color("#ffffff"))
	var tween := create_tween()
	tween.tween_interval(0.07)
	tween.tween_callback(func(): sprite.texture = warrior_texture if encounter_index % 2 == 0 else archer_texture)

func _hero_texture(skin: Color, cloth: Color) -> ImageTexture:
	var image := Image.create(24, 32, false, Image.FORMAT_RGBA8)
	image.fill(Color(0, 0, 0, 0))
	_rect(image, 9, 2, 6, 6, skin)
	_rect(image, 7, 9, 10, 10, cloth)
	_rect(image, 4, 10, 3, 9, skin)
	_rect(image, 17, 10, 3, 9, skin)
	_rect(image, 8, 19, 4, 9, Color("#3b2b2b"))
	_rect(image, 13, 19, 4, 9, Color("#3b2b2b"))
	_rect(image, 10, 4, 1, 1, Color("#111111"))
	_rect(image, 14, 4, 1, 1, Color("#111111"))
	_rect(image, 5, 7, 14, 2, Color("#6f5b42"))
	return ImageTexture.create_from_image(image)

func _rect(image: Image, x: int, y: int, w: int, h: int, color: Color) -> void:
	for px in range(x, x + w):
		for py in range(y, y + h):
			image.set_pixel(px, py, color)

func _add_kenney_room(i: int, z: float) -> void:
	var path := "res://assets/kenney_modular_dungeon/Models/GLB format/room-large.glb" if i % 2 == 0 else "res://assets/kenney_modular_dungeon/Models/GLB format/room-wide.glb"
	var packed := load(path)
	if packed == null:
		return
	var room: Node3D = packed.instantiate()
	room.position = Vector3(0, -0.55, z)
	room.scale = Vector3(1.25, 1.25, 1.25)
	add_child(room)

func _add_door(pos: Vector3) -> void:
	var sprite := Sprite3D.new()
	sprite.texture = load("res://assets/generated/door.png")
	sprite.pixel_size = 0.0018
	sprite.position = pos
	add_child(sprite)

func _box(pos: Vector3, scale: Vector3, mat: Material) -> void:
	var mesh := MeshInstance3D.new()
	mesh.mesh = BoxMesh.new()
	mesh.scale = scale
	mesh.position = pos
	mesh.material_override = mat
	add_child(mesh)

func _mat(color: Color) -> StandardMaterial3D:
	var mat := StandardMaterial3D.new()
	mat.albedo_color = color
	mat.texture_filter = BaseMaterial3D.TEXTURE_FILTER_NEAREST
	return mat

func _texture_mat(path: String, fallback: Color) -> StandardMaterial3D:
	var mat := _mat(fallback)
	var texture := load(path)
	if texture:
		mat.albedo_texture = texture
		mat.uv1_scale = Vector3(3, 3, 1)
	return mat
