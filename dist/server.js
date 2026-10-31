exports = globalThis.exports;
let node_fs_promises = require("node:fs/promises");
// ../../../packages/lib/src/server/rateLimit.ts
var SourceLock = class {
	active = new Set();
	async run(source, busy, task) {
		if (this.active.has(source)) return busy;
		this.active.add(source);
		try {
			return await task();
		} finally {
			this.active.delete(source);
		}
	}
	release(source) {
		this.active.delete(source);
	}
}, RateLimit = class {
	count;
	windowMs;
	hits = new Map();
	constructor(count, windowMs) {
		this.count = count, this.windowMs = windowMs;
	}
	take(source) {
		let now = GetGameTimer(), recent = (this.hits.get(source) ?? []).filter((at) => now - at < this.windowMs);
		return recent.length >= this.count ? (this.hits.set(source, recent), !1) : (recent.push(now), this.hits.set(source, recent), !0);
	}
	release(source) {
		this.hits.delete(source);
	}
};
// ../../../packages/lib/src/shared/read.ts
function num(value, fallback, min = -Infinity, max = Infinity) {
	return typeof value == "number" && Number.isFinite(value) ? Math.min(max, Math.max(min, value)) : fallback;
}
function int(value, fallback, min = -Infinity, max = Infinity) {
	return Math.round(num(value, fallback, min, max));
}
function str(value, fallback, max = 64) {
	return typeof value == "string" && value.trim() ? value.trim().slice(0, max) : fallback;
}
function record(value) {
	return typeof value == "object" && value && !Array.isArray(value) ? value : {};
}
// ../../../packages/lib/src/shared/strict.ts
function readFinite(value) {
	return typeof value == "number" && Number.isFinite(value) ? value : null;
}
function readInt(value, min, max) {
	return Number.isInteger(value) && value >= min && value <= max ? value : null;
}
const readId = (value) => readInt(value, 1, 2147483647), oneArg = (read) => ([value]) => {
	let parsed = read(value);
	return parsed === null ? null : [parsed];
}, fail = (error) => ({
	ok: !1,
	error
}), flatDistance = (a, b) => Math.hypot(a.x - b.x, a.y - b.y), rollChance = (percent) => Math.random() * 100 < percent;
// ../../../packages/lib/src/shared/format.ts
function groupDigits(value, separator = ",") {
	let [whole = "", fraction] = String(value).split("."), grouped = whole.replace(/\B(?=(\d{3})+(?!\d))/g, separator);
	return fraction === void 0 ? grouped : `${grouped}.${fraction}`;
}
// ../../../packages/lib/src/shared/access.ts
const isPublic = (rule) => rule.jobs.length === 0 && rule.gangs.length === 0, isObject = (value) => typeof value == "object" && !!value && !Array.isArray(value);
function readRecords(raw, readOne) {
	let out = new Map();
	if (!isObject(raw)) return out;
	for (let key in raw) {
		let value = raw[key];
		if (!isObject(value)) continue;
		let parsed = readOne(key, value);
		parsed !== null && out.set(key, parsed);
	}
	return out;
}
var FileViews = class {
	read;
	updaters = new Map();
	constructor(read) {
		this.read = read;
	}
	view(file, parse) {
		let box = { value: parse(this.read(file)) };
		return this.on(file, () => box.value = parse(this.read(file))), box;
	}
	records(file, readOne) {
		let live = new LiveRecords(readOne);
		return live.reset(this.read(file)), this.on(file, (key, value) => live.update(key, value, this.read(file))), live.map;
	}
	changed(file, key, value) {
		for (let update of this.updaters.get(file) ?? []) update(key, value);
	}
	on(file, update) {
		let list = this.updaters.get(file);
		list ? list.push(update) : this.updaters.set(file, [update]);
	}
}, LiveRecords = class {
	readOne;
	map = new Map();
	constructor(readOne) {
		this.readOne = readOne;
	}
	reset(raw) {
		this.map.clear();
		for (let [key, value] of readRecords(raw, this.readOne)) this.map.set(key, value);
	}
	update(key, value, whole) {
		if (key === void 0) return this.reset(whole);
		let parsed = isObject(value) ? this.readOne(key, value) : null;
		parsed === null ? this.map.delete(key) : this.map.set(key, parsed);
	}
};
// ../../../packages/lib/src/shared/lang.ts
function formatText(template, args) {
	return template.replace(/\{(\d+)\}/g, (match, index) => {
		let value = args[Number(index)];
		return value === void 0 ? match : String(value);
	});
}
// ../../../packages/lib/src/shared/index.ts
function isRecord(value) {
	return typeof value == "object" && !!value && !Array.isArray(value);
}
function logSafe(text, max) {
	return text.replace(/\r?\n/g, " | ").replace(/[\u0000-\u001f\u007f]/g, "").replace(/\^\d/g, "").slice(0, max);
}
function previewJson(value, max) {
	let out = "", walk = (v, depth) => {
		if (out.length >= max) return;
		if (typeof v == "string") {
			out += JSON.stringify(v.length > max ? v.slice(0, max) : v);
			return;
		}
		if (typeof v != "object" || !v) {
			out += String(v);
			return;
		}
		if (depth > 4) {
			out += Array.isArray(v) ? "[...]" : "{...}";
			return;
		}
		if (Array.isArray(v)) {
			out += "[";
			for (let i = 0; i < v.length && out.length < max; i++) i > 0 && (out += ","), walk(v[i], depth + 1);
			out += "]";
			return;
		}
		out += "{";
		let first = !0;
		for (let key in v) {
			if (out.length >= max) break;
			first || (out += ","), first = !1, out += `${JSON.stringify(key.slice(0, 50))}:`, walk(v[key], depth + 1);
		}
		out += "}";
	};
	return walk(value, 0), out.slice(0, max);
}
function createLogger(resource) {
	let prefix = `[${resource}]`;
	return {
		info: (message, ...details) => console.log(`${prefix} ${message}`, ...details),
		warn: (message, ...details) => console.warn(`${prefix} ^3${message}^7`, ...details),
		error: (message, ...details) => console.error(`${prefix} ^1${message}^7`, ...details)
	};
}
function withoutSchemaKey(value) {
	if (!isRecord(value) || !("$schema" in value)) return value;
	let { $schema: _schema, ...rest } = value;
	return rest;
}
var DataFile = class {
	resource;
	name;
	log;
	writes = Promise.resolve();
	pending = void 0;
	timer = null;
	schemaRef = null;
	constructor(resource, name, log) {
		this.resource = resource, this.name = name, this.log = log;
	}
	hasSchemaRef() {
		return (LoadResourceFile(this.resource, this.path) ?? "").includes("\"$schema\"");
	}
	read() {
		for (let path of [this.path, `${this.path}.bak`]) {
			let raw = LoadResourceFile(this.resource, path);
			if (raw) try {
				return withoutSchemaKey(JSON.parse(raw));
			} catch (error) {
				this.log.error(`${this.resource}/${path} is not valid JSON${path === this.path ? ", trying the backup" : ""}`, error);
			}
		}
		return null;
	}
	write(value) {
		this.pending = value, this.timer ||= setTimeout(() => {
			this.timer = null;
			let data = this.schemaRef && isRecord(this.pending) ? {
				$schema: this.schemaRef,
				...this.pending
			} : this.pending, text = `${JSON.stringify(data, null, 2)}\n`;
			this.writes = this.writes.then(() => this.flush(text)).catch((error) => this.log.error(`saving ${this.resource}/${this.path} failed`, error));
		}, 250);
	}
	get path() {
		return `data/${this.name}.json`;
	}
	async flush(text) {
		let file = `${GetResourcePath(this.resource)}/${this.path}`;
		await (0, node_fs_promises.mkdir)(file.slice(0, file.lastIndexOf("/")), { recursive: !0 }), await (0, node_fs_promises.writeFile)(`${file}.tmp`, text, "utf8"), await (0, node_fs_promises.copyFile)(file, `${file}.bak`).catch(() => void 0), await (0, node_fs_promises.rename)(`${file}.tmp`, file);
	}
};
// ../../../packages/shared/src/core.ts
const CORE = {
	resource: "ai-core",
	clientErrorEvent: "ai-core:clientError",
	playerLoadedEvent: "ai-core:playerLoaded",
	playerUnloadedEvent: "ai-core:playerUnloaded",
	moneyChangedEvent: "ai-core:moneyChanged",
	jobsChangedEvent: "ai-core:jobsChanged",
	dutyChangedEvent: "ai-core:dutyChanged",
	gangsChangedEvent: "ai-core:gangsChanged",
	activeGangChangedEvent: "ai-core:activeGangChanged",
	metaChangedEvent: "ai-core:metaChanged",
	definitionsChangedEvent: "ai-core:definitionsChanged",
	characterScreenEvent: "ai-core:characterScreen",
	inventoryChangedEvent: "ai-core:inventoryChanged",
	itemUsedEvent: "ai-core:itemUsed",
	playerDiedEvent: "ai-core:playerDied",
	clientPlayerLoadedEvent: "ai-core:client:playerLoaded",
	clientPlayerUnloadedEvent: "ai-core:client:playerUnloaded",
	clientCharacterPortraitEvent: "ai-core:client:characterPortrait",
	characterLooksEvent: "ai-core:client:characterLooks",
	clientCacheEvent: "ai-core:client:cache",
	clientHudVisibleEvent: "ai-core:client:hudVisible",
	clientWorldSyncEvent: "ai-core:client:worldSync",
	clientDefinitionsEvent: "ai-core:client:definitions",
	vehicleTypeCallback: "ai-core:vehicleType",
	interactionStateKey: "ai:interaction",
	pvpStateKey: "ai:pvp",
	medicalStateKey: "ai:medical",
	clientDeadEvent: "ai-core:client:dead",
	mdtStateKey: "ai:mdt",
	billsEvent: "ai-core:client:bills",
	payBillCallback: "ai-core:payBill",
	clientSeatbeltEvent: "ai-core:client:seatbelt",
	stressRelayEvent: "ai-core:client:stress",
	notifyStateKey: "ai:notify",
	charactersCallback: "ai-core:characters",
	createCharacterCallback: "ai-core:createCharacter",
	deleteCharacterCallback: "ai-core:deleteCharacter",
	selectCharacterCallback: "ai-core:selectCharacter",
	spawnEvent: "ai-core:client:spawn",
	chooseSpawnEvent: "ai-core:client:chooseSpawn",
	spawnChoiceCallback: "ai-core:spawnChoice",
	openCharactersEvent: "ai-core:client:openCharacters"
}, ADMIN = {
	ace: "ai.admin",
	openCallback: "ai-core:admin:open",
	panelDataCallback: "ai-core:admin:panelData",
	applyCallback: "ai-core:admin:apply",
	closeEvent: "ai-core:admin:close",
	showEvent: "ai-core:admin:show",
	deltaEvent: "ai-core:admin:delta",
	recommendationEvent: "ai-core:admin:recommendation",
	worldEvent: (resource) => `${resource}:admin:world`,
	worldChangesCallback: (resource) => `${resource}:admin:worldChanges`
}, LIB_UI = {
	resource: "ai-lib",
	notifyEvent: "ai-lib:client:notify",
	promptPressedEvent: "ai-lib:client:promptPressed",
	cancelProgressEvent: "ai-lib:client:cancelProgress",
	progressForCallback: "ai-lib:progressFor",
	progressForCancelEvent: "ai-lib:client:progressForCancel",
	minigameForCallback: "ai-lib:minigameFor",
	zoneEvent: "ai-lib:client:zone",
	modelPointEvent: "ai-lib:client:modelPoint"
}, named = new Set();
function registerExport(name, handler) {
	named.add(name), globalThis.exports(name, handler);
	let first = name.charAt(0), twin = (first === first.toUpperCase() ? first.toLowerCase() : first.toUpperCase()) + name.slice(1);
	twin !== name && !named.has(twin) && globalThis.exports(twin, handler);
}
function resourceExport(resource) {
	return globalThis.exports[resource];
}
function isResourceStarted(resource) {
	return GetResourceState(resource) === "started";
}
function optionalExport(resource) {
	return isResourceStarted(resource) ? globalThis.exports[resource] : null;
}
function readLocaleFile(resource, lang) {
	let raw = LoadResourceFile(resource, `locales/${lang}.json`);
	if (!raw) return {};
	let parsed = JSON.parse(raw);
	if (!isRecord(parsed)) return {};
	let texts = {};
	for (let [key, value] of Object.entries(parsed)) typeof value == "string" && (texts[key] = value);
	return texts;
}
function createLocale() {
	let texts = loadLocaleTexts();
	return (key, ...args) => formatText(texts[key] ?? key, args);
}
function loadLocaleTexts(resource = GetCurrentResourceName()) {
	let lang = GetConvar("ai:locale", "en"), texts = {
		...readLocaleFile(resource, "en"),
		...lang === "en" ? {} : readLocaleFile(resource, lang)
	};
	for (let key of Object.keys(texts)) texts[key] = (texts[key] ?? "").replace(/\$\{([A-Z0-9_]+)\}/g, (match, ref) => texts[ref] ?? match);
	return texts;
}
// ../../../packages/lib/src/fivem/callbackNames.ts
const requestEvent = (name) => `aicore:cb:${name}`, responseEvent = (resource) => `aicore:cbr:${resource}`;
// ../../../packages/lib/src/server/position.ts
function entityCoords(entity) {
	let [x = 0, y = 0, z = 0] = GetEntityCoords(entity);
	return {
		x,
		y,
		z
	};
}
const coordsOf = (source) => entityCoords(GetPlayerPed(String(source)));
function vehicleOf(source, options = {}) {
	let ped = GetPlayerPed(String(source)), vehicle = GetVehiclePedIsIn(ped, !1);
	return !vehicle || !options.driver || GetPedInVehicleSeat(vehicle, -1) === ped ? vehicle : 0;
}
function isNear(source, point, metres) {
	let [x = 0, y = 0, z = 0] = GetEntityCoords(GetPlayerPed(String(source))), dx = x - point.x, dy = y - point.y, dz = z - point.z;
	return dx * dx + dy * dy + dz * dz <= metres * metres;
}
// ../../../packages/lib/src/server/gate.ts
const core$26 = resourceExport(CORE.resource), log$6 = createLogger(GetCurrentResourceName()), hasCharacter = () => (source) => core$26.GetCharacter(source) !== null || "no character loaded", gates = new Set();
on("playerDropped", () => {
	let source = Number(globalThis.source);
	for (let gate of gates) gate.release(source);
});
var ClientGate = class {
	name;
	options;
	limit;
	lock;
	refusals = new Map();
	constructor(name, options, defaultRate) {
		this.name = name, this.options = options, this.limit = new RateLimit(options.rate?.count ?? defaultRate, options.rate?.windowMs ?? 1e3), this.lock = options.lock ? new SourceLock() : null, gates.add(this);
	}
	check(source, raw) {
		if (!(source > 0) || !GetPlayerName(String(source))) return null;
		if (!this.limit.take(source)) return this.refuse(source, "rate limit"), null;
		for (let guard of this.options.guards ?? []) {
			let verdict = guard(source);
			if (verdict !== !0) return typeof verdict == "string" && this.refuse(source, verdict), null;
		}
		if (!this.options.args) return [];
		let args = this.options.args(raw);
		return args === null && this.refuse(source, () => `invalid arguments ${logSafe(previewJson(raw, 200), 200)}`), args;
	}
	run(source, busy, task) {
		return this.lock ? this.lock.run(source, busy, async () => task()) : Promise.resolve(task());
	}
	release(source) {
		this.limit.release(source), this.lock?.release(source), this.refusals.delete(source);
	}
	refuse(source, reason) {
		let now = GetGameTimer(), last = this.refusals.get(source);
		if (last && now - last.at < 1e4) {
			last.skipped++;
			return;
		}
		let more = last?.skipped ? ` (+${last.skipped} more refused)` : "";
		this.refusals.set(source, {
			at: now,
			skipped: 0
		}), log$6.warn(`${this.name} refused for ${GetPlayerName(String(source))} (${source}): ${typeof reason == "string" ? reason : reason()}${more}`);
	}
};
// ../../../packages/lib/src/server/callback.ts
const log$5 = createLogger(GetCurrentResourceName()), resource$1 = GetCurrentResourceName(), REFUSED = Symbol("refused");
function onClientCallback(name, first, second) {
	let [handler, options] = typeof first == "function" ? [first, second ?? {}] : [second, first], gate = new ClientGate(name, options, 20);
	onNet(requestEvent(name), async (caller, id, ...raw) => {
		let source = Number(globalThis.source);
		if (typeof caller != "string" || caller.length > 64 || typeof id != "number") return;
		let args = gate.check(source, raw);
		if (!args) return emitNet(responseEvent(caller), source, id, !1, null);
		try {
			let result = await gate.run(source, REFUSED, () => handler(source, ...args));
			result === REFUSED ? emitNet(responseEvent(caller), source, id, !1, null) : emitNet(responseEvent(caller), source, id, !0, result ?? null);
		} catch (error) {
			log$5.error(`callback ${name} failed for ${source}`, error), emitNet(responseEvent(caller), source, id, !1, null);
		}
	});
}
const pending = new Map();
onNet(responseEvent(resource$1), (id, ok, result) => {
	let entry = typeof id == "number" ? pending.get(id) : void 0;
	entry && entry.source === Number(globalThis.source) && (pending.delete(id), clearTimeout(entry.timer), ok === !0 ? entry.resolve(result) : entry.reject(Error("client callback failed")));
});
// ../../../packages/lib/src/server/admin/patch.ts
function toPatch(value) {
	if (!isRecord(value) || typeof value.file != "string") return null;
	let key = typeof value.key == "string" ? value.key : void 0;
	switch (value.action) {
		case "set": return typeof value.section == "string" ? {
			file: value.file,
			action: "set",
			key,
			section: value.section,
			value: value.value
		} : null;
		case "create": return key && typeof value.label == "string" ? {
			file: value.file,
			action: "create",
			key,
			label: value.label
		} : null;
		case "delete": return key ? {
			file: value.file,
			action: "delete",
			key
		} : null;
		case "run": return typeof value.id == "string" && value.id.length <= 64 ? {
			file: value.file,
			action: "run",
			key,
			id: value.id
		} : null;
		case "import": {
			if (!isRecord(value.records)) return null;
			let records = {};
			for (let [k, v] of Object.entries(value.records)) isRecord(v) && (records[k] = v);
			return Object.keys(records).length > 0 && Object.keys(records).length <= 500 ? {
				file: value.file,
				action: "import",
				records
			} : null;
		}
		default: return null;
	}
}
const clone = (value) => value === void 0 ? value : JSON.parse(JSON.stringify(value)), core$25 = resourceExport(CORE.resource), ERR = {
	type: "ADMIN_ERR_TYPE",
	range: "ADMIN_ERR_RANGE",
	length: "ADMIN_ERR_LENGTH",
	pattern: "ADMIN_ERR_PATTERN",
	required: "ADMIN_ERR_REQUIRED",
	lookup: "ADMIN_ERR_LOOKUP"
}, lookups = new class {
	lists = new Map();
	values(source) {
		let cached = this.lists.get(source);
		if (cached && Date.now() - cached.at < 2e3) return cached.values.size > 0 ? cached.values : null;
		let list = [];
		try {
			list = core$25.GetLookupValues(source);
		} catch {}
		let values = new Set(Array.isArray(list) ? list.filter((v) => typeof v == "string") : []);
		return this.lists.set(source, {
			at: Date.now(),
			values
		}), values.size > 0 ? values : null;
	}
}(), isVec = (value, keys) => isRecord(value) && keys.every((k) => typeof value[k] == "number" && Number.isFinite(value[k]));
function validate(spec, value, path) {
	if (value == null) return spec.optional ? null : {
		error: ERR.required,
		path
	};
	let fail = (error) => ({
		error,
		path
	});
	switch (spec.type) {
		case "text": return typeof value == "string" ? value.length < (spec.min ?? 1) || value.length > (spec.max ?? 120) ? fail(ERR.length) : spec.pattern && !new RegExp(spec.pattern).test(value) ? fail(ERR.pattern) : spec.lookup && value !== "" && lookups.values(spec.lookup)?.has(value) === !1 ? fail(ERR.lookup) : null : fail(ERR.type);
		case "number": return typeof value != "number" || !Number.isFinite(value) || spec.integer && !Number.isInteger(value) ? fail(ERR.type) : spec.min !== void 0 && value < spec.min || spec.max !== void 0 && value > spec.max ? fail(ERR.range) : null;
		case "bool": return typeof value == "boolean" ? null : fail(ERR.type);
		case "enum": return spec.values.includes(value) ? null : fail(ERR.type);
		case "names": {
			if (!Array.isArray(value) || value.length > (spec.max ?? 50)) return fail(ERR.length);
			let pattern = new RegExp(spec.pattern ?? "^[\\w.:-]+$"), seen = new Set();
			for (let name of value) {
				if (typeof name != "string" || name.length > (spec.itemMax ?? 64) || seen.has(name)) return fail(ERR.type);
				if (!pattern.test(name)) return fail(ERR.pattern);
				if (spec.lookup && lookups.values(spec.lookup)?.has(name) === !1) return fail(ERR.lookup);
				seen.add(name);
			}
			return null;
		}
		case "vec3": return isVec(value, [
			"x",
			"y",
			"z"
		]) ? null : fail(ERR.type);
		case "vec4": return isVec(value, [
			"x",
			"y",
			"z",
			"heading"
		]) ? null : fail(ERR.type);
		case "object":
			if (!isRecord(value)) return fail(ERR.type);
			for (let key of Object.keys(value)) if (!(key in spec.fields)) return {
				error: ERR.type,
				path: `${path}.${key}`
			};
			for (let [key, field] of Object.entries(spec.fields)) {
				let refusal = validate(field, value[key], `${path}.${key}`);
				if (refusal) return refusal;
			}
			return null;
		case "list":
			if (!Array.isArray(value)) return fail(ERR.type);
			if (value.length < (spec.min ?? 0) || value.length > (spec.max ?? 100)) return fail(ERR.length);
			for (let i = 0; i < value.length; i++) {
				let refusal = validate(spec.of, value[i], `${path}.${i + 1}`);
				if (refusal) return refusal;
			}
			return null;
		default: return spec;
	}
}
// ../../../packages/lib/src/server/admin/edit.ts
const DEFAULT_KEY = "^[a-z0-9_]{2,32}$";
function imported(spec, value) {
	let base = clone(spec.newRecord ?? {}), out = {};
	for (let name of Object.keys(spec.sections)) {
		let v = name in value ? value[name] : base[name];
		v !== void 0 && (out[name] = clone(v));
	}
	return out;
}
function linked(spec, value, ctx) {
	return spec.type === "text" && spec.records && typeof value == "string" && value !== "" && !(value in ctx.get(spec.records)) ? "ADMIN_ERR_LOOKUP" : null;
}
function checkEdit(patch, spec, ctx) {
	let data = ctx.get(patch.file);
	if (patch.action === "create") return spec.kind !== "records" || !new RegExp(spec.keyPattern ?? DEFAULT_KEY).test(patch.key) ? ERR.pattern : patch.key in data ? "ADMIN_ERR_EXISTS" : null;
	if (patch.action === "delete") return spec.kind !== "records" || !(patch.key in data) ? ERR.type : spec.locked?.includes(patch.key) ? "ADMIN_ERR_LOCKED" : null;
	if (patch.action === "import") {
		if (spec.kind !== "records") return ERR.type;
		let pattern = new RegExp(spec.keyPattern ?? DEFAULT_KEY);
		for (let [key, value] of Object.entries(patch.records)) {
			if (!pattern.test(key)) return ERR.pattern;
			let record = imported(spec, value);
			for (let [name, section] of Object.entries(spec.sections)) {
				let refusal = validate(section, record[name], name);
				if (refusal) return refusal.error;
				let link = linked(section, record[name], ctx);
				if (link) return link;
			}
			let ruled = ctx.rule(patch.file)?.(key, record);
			if (ruled) return ruled;
		}
		return null;
	}
	let section = spec.sections[patch.section];
	if (!section || spec.kind === "records" && (!patch.key || !(patch.key in data))) return ERR.type;
	let refusal = validate(section, patch.value, patch.section);
	if (refusal) return refusal.error;
	let link = linked(section, patch.value, ctx);
	if (link) return link;
	let current = spec.kind === "records" ? data[patch.key ?? ""] : data, next = {
		...isRecord(current) ? current : {},
		[patch.section]: patch.value
	};
	return ctx.rule(patch.file)?.(patch.key, next) ?? null;
}
function applyEdit(data, patch, spec) {
	if (patch.action === "import") {
		for (let [key, value] of Object.entries(patch.records)) data[key] = imported(spec, value);
		return Object.keys(patch.records);
	}
	if (patch.action === "create") {
		let record = clone(spec.newRecord ?? {});
		spec.labelPath && (record[spec.labelPath] = patch.label), data[patch.key] = record;
	} else if (patch.action === "delete") delete data[patch.key];
	else {
		let target = spec.kind === "records" ? data[patch.key ?? ""] : data;
		if (!isRecord(target)) return [];
		patch.value === void 0 || patch.value === null ? delete target[patch.section] : target[patch.section] = clone(patch.value);
	}
	return [spec.kind === "records" ? patch.key : void 0];
}
// ../../../packages/lib/src/server/admin/jsonSchema.ts
const SCHEMA_KEY = {
	type: "string",
	description: "This file's JSON Schema (for editors)."
};
function langFile(resource) {
	try {
		let raw = JSON.parse(LoadResourceFile(resource, "locales/en.json") ?? "{}");
		return isRecord(raw) ? Object.fromEntries(Object.entries(raw).filter((e) => typeof e[1] == "string")) : {};
	} catch {
		return {};
	}
}
function texts$1(resource) {
	return {
		...langFile("ai-core"),
		...langFile(resource)
	};
}
function collect(fields, prefix, lang, out) {
	for (let field of fields) {
		if (field.widget === "action") continue;
		let path = prefix + field.path, label = lang[field.label] ?? field.label, hint = field.hint ? lang[field.hint] ?? field.hint : "";
		out.has(path) || out.set(path, hint ? `${label}: ${hint}` : label), field.widget === "list" && collect(field.rows, `${path}[].`, lang, out);
	}
}
function describe(schema, file, lang) {
	let out = new Map();
	for (let tab of schema.tabs) if (tab.file === file) for (let card of tab.cards) collect(card.fields, "", lang, out);
	return out;
}
function toJson(spec, path, desc) {
	let description = desc.get(path), base = description ? { description } : {};
	switch (spec.type) {
		case "text": return {
			...base,
			type: "string",
			minLength: spec.min,
			maxLength: spec.max,
			pattern: spec.pattern
		};
		case "number": return {
			...base,
			type: spec.integer ? "integer" : "number",
			minimum: spec.min,
			maximum: spec.max
		};
		case "bool": return {
			...base,
			type: "boolean"
		};
		case "enum": return {
			...base,
			enum: spec.values
		};
		case "names": return {
			...base,
			type: "array",
			maxItems: spec.max,
			uniqueItems: !0,
			items: {
				type: "string",
				maxLength: spec.itemMax,
				pattern: spec.pattern
			}
		};
		case "vec3":
		case "vec4": {
			let keys = spec.type === "vec3" ? [
				"x",
				"y",
				"z"
			] : [
				"x",
				"y",
				"z",
				"heading"
			];
			return {
				...base,
				type: "object",
				required: keys,
				properties: Object.fromEntries(keys.map((k) => [k, { type: "number" }]))
			};
		}
		case "object": return {
			...base,
			...objectOf(spec.fields, path ? `${path}.` : "", desc)
		};
		case "list": return {
			...base,
			type: "array",
			minItems: spec.min,
			maxItems: spec.max,
			items: toJson(spec.of, `${path}[]`, desc)
		};
		default: return spec;
	}
}
function objectOf(fields, prefix, desc) {
	return {
		type: "object",
		properties: Object.fromEntries(Object.entries(fields).map(([k, s]) => [k, toJson(s, prefix + k, desc)])),
		required: Object.entries(fields).filter(([, s]) => !s.optional).map(([k]) => k)
	};
}
function fileSchema(resource, schema, name, spec) {
	let desc = describe(schema, name, texts$1(resource)), title = `${resource}/data/${name}.json`, body = spec.kind === "settings" ? (() => {
		let obj = objectOf(spec.sections, "", desc), required = obj.required.filter((k) => !(k in (spec.defaults ?? {})));
		return {
			...obj,
			properties: {
				$schema: SCHEMA_KEY,
				...obj.properties
			},
			required
		};
	})() : {
		type: "object",
		properties: { $schema: SCHEMA_KEY },
		patternProperties: { [spec.keyPattern ?? "^[a-z0-9_]{2,32}$"]: objectOf(spec.sections, "", desc) },
		additionalProperties: !1
	};
	return `${JSON.stringify({
		$schema: "http://json-schema.org/draft-07/schema#",
		title,
		...body
	}, null, 2)}\n`;
}
function writeSchema(resource, name, text, log) {
	let path = `data/schemas/${name}.schema.json`;
	if (LoadResourceFile(resource, path) === text) return;
	let dir = `${GetResourcePath(resource)}/data/schemas`;
	(0, node_fs_promises.mkdir)(dir, { recursive: !0 }).then(() => (0, node_fs_promises.writeFile)(`${dir}/${name}.schema.json`, text, "utf8")).catch((error) => log.error(`writing ${resource}/${path} failed`, error));
}
// ../../../packages/lib/src/server/admin/panel.ts
const core$24 = resourceExport(CORE.resource);
var AdminPanel = class {
	schema;
	data = new Map();
	dataFiles = new Map();
	handlers = new Map();
	rules = new Map();
	actions = new Map();
	views = new FileViews((file) => this.get(file));
	worldChanges = new Map();
	resource = GetCurrentResourceName();
	log = createLogger(this.resource);
	editor = 0;
	constructor(schema) {
		this.schema = schema;
		for (let [name, spec] of Object.entries(schema.files)) this.load(name, spec);
		registerExport("AdminPanelSnapshot", () => this.snapshot()), registerExport("AdminPanelData", () => this.dataSnapshot()), registerExport("AdminPanelSummary", () => this.summary()), registerExport("AdminPanelApply", (admin, patch) => this.apply(admin, patch)), onClientCallback(ADMIN.worldChangesCallback(this.resource), () => Object.fromEntries(this.worldChanges), { rate: {
			count: 4,
			windowMs: 1e4
		} }), setImmediate(() => core$24.RegisterAdminPanel(this.resource));
	}
	get(file) {
		return this.data.get(file) ?? {};
	}
	onChange(file, handler) {
		this.handlers.set(file, [...this.handlers.get(file) ?? [], handler]);
	}
	rule(file, rule) {
		this.rules.set(file, rule);
	}
	onAction(id, handler) {
		this.actions.set(id, handler);
	}
	view(file, read) {
		return this.views.view(file, read);
	}
	records(file, readOne) {
		return this.views.records(file, readOne);
	}
	snapshot() {
		return {
			resource: this.resource,
			schema: this.schema,
			texts: loadLocaleTexts(),
			data: this.dataSnapshot()
		};
	}
	dataSnapshot() {
		return clone(Object.fromEntries(this.data));
	}
	summary() {
		let data = {}, index = {};
		for (let [file, spec] of Object.entries(this.schema.files)) {
			let content = this.data.get(file);
			if (spec.kind !== "records") {
				data[file] = clone(content ?? {});
				continue;
			}
			let labels = {};
			for (let [key, record] of Object.entries(content ?? {})) labels[key] = labelOf(record, spec.labelPath) ?? key;
			index[file] = labels;
		}
		return {
			resource: this.resource,
			schema: this.schema,
			texts: loadLocaleTexts(),
			data,
			loaded: !1,
			index
		};
	}
	apply(admin, raw) {
		let patch = toPatch(raw), spec = patch ? this.schema.files[patch.file] : void 0;
		if (!patch || !spec) return {
			ok: !1,
			error: ERR.type
		};
		this.editor = admin;
		try {
			if (patch.action === "run") return this.run(admin, patch, spec);
			if (spec.memory) return {
				ok: !1,
				error: ERR.type
			};
			let error = checkEdit(patch, spec, {
				get: (file) => this.get(file),
				rule: (file) => this.rules.get(file)
			});
			return error ? (this.log.warn(`admin ${admin} edit refused (${error}): ${previewJson(patch, 300)}`), {
				ok: !1,
				error
			}) : (this.store(patch, spec), { ok: !0 });
		} finally {
			this.editor = 0;
		}
	}
	run(admin, patch, spec) {
		let handler = this.actions.get(patch.id), data = this.get(patch.file), target = spec.kind === "records" ? data[patch.key ?? ""] : data;
		if (!handler || !isRecord(target)) return {
			ok: !1,
			error: ERR.type
		};
		try {
			let error = handler(admin, clone(target), patch.key);
			return error ? {
				ok: !1,
				error
			} : { ok: !0 };
		} catch (error) {
			return this.log.error(`panel action ${patch.id} failed`, error), {
				ok: !1,
				error: ERR.type
			};
		}
	}
	commit(file, key, value) {
		let data = this.data.get(file);
		data && (key === void 0 ? isRecord(value) && this.data.set(file, clone(value)) : value === null ? delete data[key] : data[key] = clone(value), this.changed(file, key));
	}
	commitAfter(file, key, value) {
		setImmediate(() => this.commit(file, key, value));
	}
	store(patch, spec) {
		let data = this.data.get(patch.file) ?? {}, keys = applyEdit(data, patch, spec);
		if (keys.length !== 0) {
			this.data.set(patch.file, data);
			for (let key of keys) this.changed(patch.file, key);
		}
	}
	changed(file, key) {
		let spec = this.schema.files[file], data = this.get(file), value = key === void 0 ? data : data[key] ?? null;
		this.dataFiles.get(file)?.write(data), this.views.changed(file, key, value);
		for (let handler of this.handlers.get(file) ?? []) handler(key, value);
		if (core$24.AdminPanelChanged({
			resource: this.resource,
			file,
			key,
			value: clone(value)
		}), spec?.sync !== "all") return;
		let changes = this.worldChanges.get(file) ?? {};
		changes[key ?? ""] = clone(value), this.worldChanges.set(file, changes), emitNet(ADMIN.worldEvent(this.resource), -1, file, key ?? null, value);
	}
	load(name, spec) {
		if (spec.memory) {
			this.data.set(name, {});
			return;
		}
		let file = new DataFile(this.resource, name, this.log);
		this.dataFiles.set(name, file), file.schemaRef = `./schemas/${name}.schema.json`, writeSchema(this.resource, name, fileSchema(this.resource, this.schema, name, spec), this.log);
		let raw = file.read(), data = isRecord(raw) ? raw : {}, filled = !1;
		if (spec.kind === "settings") for (let [section, value] of Object.entries(spec.defaults ?? {})) section in data || (data[section] = clone(value), filled = !0);
		this.data.set(name, data), (filled || raw === null || !file.hasSchemaRef()) && file.write(data);
	}
};
function labelOf(record, path) {
	if (!path) return null;
	let at = record;
	for (let part of path.split(".")) {
		if (typeof at != "object" || !at) return null;
		at = at[part];
	}
	return typeof at == "string" && at !== "" ? at : null;
}
// ../../../packages/lib/src/server/log.ts
function aiLog(channel, message, options) {
	optionalExport("ai-core")?.Log(channel, message, options);
}
function aiLogChannels(channels) {
	optionalExport("ai-core")?.LogChannels(channels);
}
// ../../../packages/lib/src/server/notify.ts
function notify(source, text, kind = "info", duration) {
	let notification = {
		text,
		kind,
		duration
	};
	emitNet(LIB_UI.notifyEvent, source, notification);
}
resourceExport(CORE.resource);
// ../../../packages/lib/src/server/online.ts
const core$22 = resourceExport(CORE.resource);
function reindex(index, source, before, after) {
	for (let name of before) {
		let set = index.get(name);
		set && (set.delete(source), set.size === 0 && index.delete(name));
	}
	for (let name of after) {
		let set = index.get(name);
		set || index.set(name, set = new Set()), set.add(source);
	}
}
var OnlinePlayers = class {
	players = new Map();
	onDuty = new Map();
	jobIndex = new Map();
	gangIndex = new Map();
	started = !1;
	start() {
		if (this.started) return;
		this.started = !0;
		let load = (source, character) => {
			this.drop(source), this.players.set(source, {
				character,
				jobs: [],
				jobNames: [],
				gangs: [],
				gangNames: [],
				duty: null
			}), this.setJobs(source, core$22.GetJobs(source) ?? []), this.setGangs(source, core$22.GetGangs(source) ?? []), this.setDuty(source, core$22.GetDutyJob(source));
		};
		on(CORE.playerLoadedEvent, load), on(CORE.playerUnloadedEvent, (source) => this.drop(source)), on(CORE.jobsChangedEvent, (source, jobs) => this.setJobs(source, jobs)), on(CORE.gangsChangedEvent, (source, gangs) => this.setGangs(source, gangs)), on(CORE.dutyChangedEvent, (source, job) => this.setDuty(source, job));
		for (let source of core$22.GetLoadedSources()) {
			let character = core$22.GetCharacter(source);
			character && load(source, character);
		}
	}
	drop(source) {
		let player = this.players.get(source);
		player && (this.setDuty(source, null), reindex(this.jobIndex, source, player.jobNames, []), reindex(this.gangIndex, source, player.gangNames, []), this.players.delete(source));
	}
	setJobs(source, jobs) {
		let player = this.players.get(source);
		if (!player) return;
		let names = jobs.map((m) => m.job);
		reindex(this.jobIndex, source, player.jobNames, names), player.jobs = jobs, player.jobNames = names;
	}
	setGangs(source, gangs) {
		let player = this.players.get(source);
		if (!player) return;
		let names = gangs.map((m) => m.gang);
		reindex(this.gangIndex, source, player.gangNames, names), player.gangs = gangs, player.gangNames = names;
	}
	setDuty(source, job) {
		let player = this.players.get(source);
		if (!player) return;
		if (player.duty) {
			let set = this.onDuty.get(player.duty);
			set?.delete(source), set?.size === 0 && this.onDuty.delete(player.duty);
		}
		if (player.duty = job, !job) return;
		let set = this.onDuty.get(job);
		set || this.onDuty.set(job, set = new Set()), set.add(source);
	}
	sources() {
		return this.start(), this.players.keys();
	}
	get size() {
		return this.start(), this.players.size;
	}
	character(source) {
		return this.start(), this.players.get(source)?.character ?? null;
	}
	charId(source) {
		return this.start(), this.players.get(source)?.character.id;
	}
	name(source, options = {}) {
		let c = this.character(source);
		return c ? `${c.firstname} ${c.lastname}` : options.fallback === !1 ? "" : GetPlayerName(String(source));
	}
	jobs(source) {
		return this.start(), this.players.get(source)?.jobNames ?? [];
	}
	gangs(source) {
		return this.start(), this.players.get(source)?.gangNames ?? [];
	}
	jobGrade(source, job) {
		return this.start(), this.players.get(source)?.jobs.find((m) => m.job === job)?.grade ?? null;
	}
	gangGrade(source, gang) {
		return this.start(), this.players.get(source)?.gangs.find((m) => m.gang === gang)?.grade ?? null;
	}
	jobMembers(job) {
		return this.start(), this.jobIndex.get(job) ?? EMPTY;
	}
	gangMembers(gang) {
		return this.start(), this.gangIndex.get(gang) ?? EMPTY;
	}
	dutyJob(source) {
		return this.start(), this.players.get(source)?.duty ?? null;
	}
	onDutyIn(source, jobs) {
		let duty = this.dutyJob(source);
		return duty !== null && jobs.includes(duty);
	}
	allows(source, rule) {
		if (isPublic(rule)) return !0;
		let min = (name) => rule.grades[name] ?? 0;
		for (let gang of rule.gangs) {
			let grade = this.gangGrade(source, gang);
			if (grade !== null && grade >= min(gang)) return !0;
		}
		let duty = rule.onDuty ? this.dutyJob(source) : null;
		for (let job of rule.jobs) {
			let grade = this.jobGrade(source, job);
			if (grade !== null && grade >= min(job) && (!rule.onDuty || duty === job)) return !0;
		}
		return !1;
	}
	countOnDuty(jobs) {
		this.start();
		let count = 0;
		for (let job of jobs) count += this.onDuty.get(job)?.size ?? 0;
		return count;
	}
	onDutyFor(job) {
		return this.start(), this.onDuty.get(job) ?? EMPTY;
	}
};
const EMPTY = new Set(), online = new OnlinePlayers();
resourceExport(CORE.resource), resourceExport(CORE.resource);
// ../../../packages/lib/src/server/proximity.ts
const core$19 = resourceExport(CORE.resource);
function within(point, radius, candidates) {
	let out = [];
	for (let source of candidates) {
		let p = coordsOf(source);
		Math.hypot(p.x - point.x, p.y - point.y, p.z - point.z) <= radius && out.push(source);
	}
	return out;
}
function playersNear(source, radius) {
	return within(coordsOf(source), radius, [source, ...core$19.GetPlayersInScope(source)]);
}
// ../../../packages/lib/src/server/players.ts
const log$4 = createLogger(GetCurrentResourceName()), dropped = new Set();
let listening$1 = !1;
function onDropped(fn) {
	listening$1 || (listening$1 = !0, on("playerDropped", () => {
		let source = Number(globalThis.source);
		for (let handler of dropped) handler(source);
	})), dropped.add(fn);
}
var PlayerMap = class extends Map {
	constructor(options = {}) {
		super(), onDropped((source) => {
			if (!this.has(source)) return;
			let value = this.get(source);
			this.delete(source), options.onDrop?.(source, value);
		});
	}
};
function onCharacter(handlers) {
	let live = new Map(), deliver = (source, character) => {
		if (live.set(source, character.id), handlers.loaded) try {
			let result = handlers.loaded(source, character);
			result instanceof Promise && result.catch((error) => log$4.error(`character loaded handler failed for ${source}`, error));
		} catch (error) {
			log$4.error(`character loaded handler failed for ${source}`, error);
		}
	}, end = (source, charId, reason) => {
		if (live.delete(source)) try {
			handlers.unloaded?.(source, charId, reason);
		} catch (error) {
			log$4.error(`character unloaded handler failed for ${source}`, error);
		}
	};
	on(CORE.playerLoadedEvent, (source, character) => {
		let previous = live.get(source);
		previous !== void 0 && end(source, previous, "switch"), deliver(source, character);
	}), on(CORE.playerUnloadedEvent, (source, charId, reason) => end(source, charId, reason === "dropped" ? "dropped" : "switch")), onDropped((source) => setImmediate(() => {
		let charId = live.get(source);
		charId !== void 0 && end(source, charId, "dropped");
	})), setImmediate(() => {
		for (let source of online.sources()) {
			if (live.has(source)) continue;
			let character = online.character(source);
			character && deliver(source, character);
		}
	});
}
// ../../../packages/lib/src/server/progressFor.ts
const running = new PlayerMap({ onDrop: (_source, settle) => settle(!1) });
on(CORE.playerUnloadedEvent, (source) => {
	let settle = running.get(source);
	settle && settle(!1);
});
// ../../../packages/lib/src/server/definitions.ts
const core$18 = resourceExport("ai-core");
new class {
	jobs = new Map();
	gangs = new Map();
	constructor() {
		on(CORE.definitionsChangedEvent, (file, name) => {
			typeof name == "string" && (file === "jobs" ? this.jobs.delete(name) : file === "gangs" && this.gangs.delete(name));
		});
	}
	job(name) {
		let def = this.jobs.get(name);
		return def === void 0 && this.jobs.set(name, def = core$18.GetJobDefinition(name) ?? null), def;
	}
	gang(name) {
		let def = this.gangs.get(name);
		return def === void 0 && this.gangs.set(name, def = core$18.GetGangDefinition(name) ?? null), def;
	}
}();
// ../../../packages/lib/src/server/command.ts
const resource = GetCurrentResourceName(), log$3 = createLogger(resource);
let texts = null;
const t = (key, ...args) => formatText((texts ??= loadLocaleTexts(CORE.resource))[key] ?? key, args);
function reply(source, text, kind) {
	source > 0 ? notify(source, text, kind) : log$3.info(text);
}
var Command = class {
	params;
	handler;
	info;
	usage;
	constructor(names, params, help, aces, handler) {
		this.params = params, this.handler = handler, this.info = {
			names,
			help,
			params: params.map((p) => ({ ...p })),
			aces
		}, this.usage = [`/${names[0]}`, ...params.map((p) => p.optional ? `[${p.name}]` : `<${p.name}>`)].join(" ");
	}
	allowed(source, name) {
		let aces = this.info.aces;
		if (source <= 0 || !aces) return !0;
		let player = String(source);
		return aces.some((ace) => IsPlayerAceAllowed(player, ace)) || !!IsPlayerAceAllowed(player, `command.${name}`);
	}
	suggestion(name) {
		return {
			name: `/${name}`,
			help: this.info.help,
			params: this.params.map((p) => ({
				name: p.name,
				help: p.help ?? ""
			}))
		};
	}
	run(source, name, raw, line) {
		if (!this.allowed(source, name)) return reply(source, t("COMMAND_NOT_ALLOWED"), "error");
		let args = this.parse(raw);
		if (typeof args == "string") return reply(source, args, "error"), reply(source, t("COMMAND_USAGE", this.usage), "info");
		let fail = (error) => log$3.error(`command /${name} failed`, error);
		try {
			let result = this.handler(source, args, line);
			result instanceof Promise && result.catch(fail);
		} catch (error) {
			fail(error);
		}
	}
	parse(raw) {
		let args = {};
		for (let [i, param] of this.params.entries()) {
			let token = param.type === "longString" ? raw.slice(i).join(" ").trim() : raw[i] ?? "";
			if (token === "") {
				if (!param.optional) return t("COMMAND_MISSING", param.name);
			} else {
				if (param.type === "number" || param.type === "playerId") {
					let value = Number(token);
					if (!Number.isFinite(value)) return t("COMMAND_NUMBER", param.name);
					if (param.type === "playerId" && (!Number.isInteger(value) || value <= 0 || !GetPlayerName(String(value)))) return t("COMMAND_PLAYER", token);
					args[param.name] = value;
				} else args[param.name] = token;
				if (param.type === "longString") break;
			}
		}
		return args;
	}
};
const commands = new class {
	list = [];
	sent = new Map();
	announced = 0;
	queued = !1;
	listening = !1;
	add(command) {
		this.listening || this.listen(), this.list.push(command), this.queued || (this.queued = !0, setImmediate(() => this.flush()));
	}
	refresh(source) {
		let before = this.sent.get(source), now = new Set(), add = [];
		for (let command of this.list) for (let name of command.info.names) command.allowed(source, name) && (now.add(name), before?.has(name) || add.push(command.suggestion(name)));
		if (this.sent.set(source, now), add.length && emitNet("chat:addSuggestions", source, add), before) for (let name of before) now.has(name) || emitNet("chat:removeSuggestion", source, `/${name}`);
	}
	flush() {
		this.queued = !1, optionalExport(CORE.resource)?.RegisterCommands(resource, this.list.slice(this.announced).map((c) => c.info)), this.announced = this.list.length;
		for (let player of getPlayers()) this.refresh(Number(player));
	}
	listen() {
		this.listening = !0;
		let refresh = (source) => this.refresh(Number(source));
		on(CORE.playerLoadedEvent, refresh), on(CORE.jobsChangedEvent, refresh), on(CORE.gangsChangedEvent, refresh), on("playerDropped", () => this.sent.delete(Number(globalThis.source))), on("onResourceStop", (name) => {
			if (name === resource) for (let command of this.list) for (let n of command.info.names) emitNet("chat:removeSuggestion", -1, `/${n}`);
		});
	}
}();
function addCommand(name, options, handler) {
	let names = (Array.isArray(name) ? name : [name]).map((n) => n.toLowerCase());
	if (names.length === 0) throw Error("addCommand needs a name");
	let restricted = options.restricted ?? !1, aces = restricted === !1 ? null : restricted === !0 ? [ADMIN.ace] : Array.isArray(restricted) ? [...restricted] : [restricted], command = new Command(names, options.params ?? [], options.help ?? "", aces, handler);
	for (let n of names) RegisterCommand(n, (source, raw, line) => command.run(Number(source), n, raw, line), !1);
	commands.add(command);
}
createLogger(GetCurrentResourceName()), createLogger("aicore-lib");
// ../../../packages/lib/src/fivem/byResource.ts
const stopHandlers = [];
let listening = !1;
function onAnyStop(handler) {
	if (stopHandlers.push(handler), listening) return;
	listening = !0;
	let event = IsDuplicityVersion() ? "onResourceStop" : "onClientResourceStop";
	on(event, (resource) => {
		for (let stop of stopHandlers) stop(resource);
	});
}
function onStop(fn) {
	let self = GetCurrentResourceName();
	onAnyStop((resource) => {
		resource === self && fn();
	});
}
let log = null;
var ScheduledJob = class {
	interval;
	fn;
	name;
	gen = 0;
	active = !1;
	stopped = !1;
	quietUntil = 0;
	skipped = 0;
	constructor(interval, fn, name) {
		this.interval = interval, this.fn = fn, this.name = name;
	}
	get running() {
		return this.active;
	}
	set(active) {
		active === this.active || active && this.stopped || (this.active = active, active ? scheduler.activate(this) : scheduler.deactivate(this));
	}
	stop() {
		this.set(!1), this.stopped = !0;
	}
	call() {
		try {
			let result = this.fn();
			result instanceof Promise && result.catch((error) => this.fail(error));
		} catch (error) {
			this.fail(error);
		}
	}
	fail(error) {
		let now = GetGameTimer();
		if (now < this.quietUntil) {
			this.skipped++;
			return;
		}
		this.quietUntil = now + 1e4;
		let more = this.skipped ? ` (+${this.skipped} more)` : "";
		this.skipped = 0, log ??= createLogger(GetCurrentResourceName()), log.error(`job "${this.name}" failed${more}`, error instanceof Error ? error.stack ?? error.message : error);
	}
}, Group = class {
	interval;
	jobs = Array(8);
	gens = Array(8).fill(0);
	dues = Array(8).fill(0);
	head = 0;
	mask = 7;
	count = 0;
	constructor(interval) {
		this.interval = interval;
	}
	get front() {
		return this.dues[this.head] ?? 0;
	}
	compactAt = 64;
	push(job, due) {
		this.count >= this.compactAt && this.compact(), this.count > this.mask && this.grow();
		let i = this.head + this.count & this.mask;
		this.jobs[i] = job, this.gens[i] = job.gen, this.dues[i] = due, this.count++;
	}
	run(now) {
		for (let left = this.count; left > 0 && this.count > 0; left--) {
			let i = this.head, due = this.dues[i] ?? 0;
			if (due > now) return;
			let job = this.jobs[i], gen = this.gens[i];
			if (this.jobs[i] = void 0, this.head = i + 1 & this.mask, this.count--, !job || job.gen !== gen) continue;
			let next = due + this.interval;
			next <= now && (next = now + this.interval), this.push(job, next), job.call();
		}
	}
	compact() {
		let kept = 0;
		for (let n = 0; n < this.count; n++) {
			let i = this.head + n & this.mask, job = this.jobs[i];
			if (!job || job.gen !== this.gens[i]) continue;
			let k = this.head + kept & this.mask;
			this.jobs[k] = job, this.gens[k] = this.gens[i] ?? 0, this.dues[k] = this.dues[i] ?? 0, kept++;
		}
		for (let n = kept; n < this.count; n++) this.jobs[this.head + n & this.mask] = void 0;
		this.count = kept, this.compactAt = Math.max(64, kept * 2);
	}
	grow() {
		let size = (this.mask + 1) * 2, jobs = Array(size), gens = Array(size).fill(0), dues = Array(size).fill(0);
		for (let n = 0; n < this.count; n++) {
			let i = this.head + n & this.mask;
			jobs[n] = this.jobs[i], gens[n] = this.gens[i] ?? 0, dues[n] = this.dues[i] ?? 0;
		}
		this.jobs = jobs, this.gens = gens, this.dues = dues, this.head = 0, this.mask = size - 1;
	}
};
const scheduler = new class {
	groups = [];
	byInterval = new Map();
	tick = null;
	active = 0;
	nextDue = Infinity;
	running = !1;
	activate(job) {
		job.gen++, this.active++;
		let due = GetGameTimer() + job.interval, group = this.byInterval.get(job.interval);
		group || (group = new Group(job.interval), this.byInterval.set(job.interval, group), this.groups.push(group)), group.push(job, due), due < this.nextDue && (this.nextDue = due), this.tick ??= setTick(this.onTick);
	}
	deactivate(job) {
		job.gen++, this.active--, this.active === 0 && !this.running && this.halt();
	}
	halt() {
		this.tick !== null && clearTick(this.tick), this.tick = null, this.groups.length = 0, this.byInterval.clear(), this.nextDue = Infinity;
	}
	onTick = () => {
		let now = GetGameTimer();
		if (now < this.nextDue) return;
		let groups = this.groups;
		this.running = !0;
		for (let i = 0; i < groups.length; i++) {
			let group = groups[i];
			group && group.count > 0 && group.front <= now && group.run(now);
		}
		if (this.running = !1, this.active === 0) return this.halt();
		let soonest = Infinity, kept = 0;
		for (let i = 0; i < groups.length; i++) {
			let group = groups[i];
			group && (group.count === 0 ? this.byInterval.delete(group.interval) : (groups[kept++] = group, group.front < soonest && (soonest = group.front)));
		}
		groups.length = kept, this.nextDue = soonest;
	};
}();
function every(ms, fn, options = {}) {
	let job = new ScheduledJob(Math.max(0, Math.floor(ms)), fn, options.name ?? (fn.name || "anonymous"));
	return options.active !== !1 && job.set(!0), job;
}
IsDuplicityVersion(), resourceExport(CORE.resource), resourceExport(CORE.resource), resourceExport(CORE.resource);
// ../../../packages/lib/src/server/dispatch.ts
const core$14 = resourceExport(CORE.resource), dispatch = { alert: (alert) => core$14.SendDispatchAlert(alert) };
resourceExport(CORE.resource), resourceExport(CORE.resource), resourceExport(CORE.resource), resourceExport(CORE.resource), resourceExport(CORE.resource), resourceExport(CORE.resource), resourceExport(CORE.resource), resourceExport(CORE.resource), resourceExport(CORE.resource), resourceExport(CORE.resource), resourceExport(CORE.resource), resourceExport(CORE.resource), resourceExport(CORE.resource);
// resource/common/locale.ts
const Locale = createLocale();
GetCurrentResourceName(), IsDuplicityVersion();
// resource/common/race.ts
const EVENTS = {
	openMenu: "ai-streetraces:client:openMenu",
	create: "ai-streetraces:create",
	join: "ai-streetraces:join",
	leave: "ai-streetraces:leave",
	begin: "ai-streetraces:begin",
	finish: "ai-streetraces:finish",
	state: "ai-streetraces:client:state",
	racer: "ai-streetraces:client:racer",
	racerLeft: "ai-streetraces:client:racerLeft",
	start: "ai-streetraces:client:start",
	ended: "ai-streetraces:client:ended",
	invite: "ai-streetraces:client:invite",
	uninvite: "ai-streetraces:client:uninvite"
}, COUNTDOWN_MS = 5e3, DEFAULT_SETTINGS = {
	account: "cash",
	minBuyIn: 100,
	maxBuyIn: 15e3,
	joinSeconds: 45,
	maxRacers: 8,
	inviteRadius: 60,
	minDistance: 500,
	maxMinutes: 10,
	alertChance: 25
};
function readSettings(raw) {
	let s = record(raw), d = DEFAULT_SETTINGS, minBuyIn = int(s.minBuyIn, d.minBuyIn, 0, 1e7);
	return {
		account: str(s.account, d.account, 32),
		minBuyIn,
		maxBuyIn: int(s.maxBuyIn, d.maxBuyIn, minBuyIn, 1e7),
		joinSeconds: int(s.joinSeconds, d.joinSeconds, 15, 300),
		maxRacers: int(s.maxRacers, d.maxRacers, 2, 16),
		inviteRadius: int(s.inviteRadius, d.inviteRadius, 10, 400),
		minDistance: int(s.minDistance, d.minDistance, 100, 1e4),
		maxMinutes: int(s.maxMinutes, d.maxMinutes, 1, 60),
		alertChance: int(s.alertChance, d.alertChance, 0, 100)
	};
}
function readCoord(value) {
	let v = readFinite(value);
	return v !== null && Math.abs(v) < 1e4 ? v : null;
}
function sampleHolds(source, last, now) {
	let p = coordsOf(source), limit = 120 * (now - last.at) / 1e3 + 30;
	return flatDistance(p, last) <= limit ? {
		x: p.x,
		y: p.y,
		at: now
	} : null;
}
function sampleOf(source, now) {
	let p = coordsOf(source);
	return {
		x: p.x,
		y: p.y,
		at: now
	};
}
function driving(source) {
	return vehicleOf(source, { driver: !0 }) !== 0;
}
function finishHolds(source, race, elapsed) {
	return elapsed < 0 || flatDistance(coordsOf(source), race.finish) > 22 || !driving(source) ? !1 : elapsed >= flatDistance(race.start, race.finish) / 100 * 1e3 || (aiLog("races", `implausible finish in race ${race.id}`, {
		level: "warn",
		source,
		metadata: { ms: elapsed }
	}), !1);
}
function maybeAlertPolice(chance, start, racers, suspect) {
	rollChance(chance) && dispatch.alert({
		title: Locale("ALERT_TITLE"),
		message: Locale("ALERT_MESSAGE", racers),
		coords: start,
		source: suspect,
		icon: "flag-checkered"
	});
}
// resource/server/purse.ts
const core = resourceExport("ai-core");
var Purse = class {
	race;
	account;
	buyIn;
	pot = 0;
	constructor(race, account, buyIn) {
		this.race = race, this.account = account, this.buyIn = buyIn;
	}
	take(source) {
		return this.buyIn > 0 && !core.RemoveMoney(source, this.account, this.buyIn, `streetrace:${this.race}`) ? !1 : (this.pot += this.buyIn, !0);
	}
	refund(source) {
		this.pot -= this.buyIn, this.pay(source, this.buyIn, "streetrace:refund");
	}
	pay(source, amount, reason) {
		amount > 0 && !core.AddMoney(source, this.account, amount, reason) && aiLog("races", `payment of race ${this.race} failed`, {
			level: "error",
			source,
			metadata: {
				amount,
				reason
			}
		});
	}
	takeAll() {
		let pot = this.pot;
		return this.pot = 0, pot;
	}
};
// resource/server/race.ts
const money = (amount) => groupDigits(amount);
var StreetRace = class {
	o;
	hooks;
	racers = new Map();
	invited = new Set();
	samples = new Map();
	startAt = 0;
	over = !1;
	timer;
	purse;
	constructor(o, hooks) {
		this.o = o, this.hooks = hooks, this.purse = new Purse(o.id, o.account, o.buyIn), this.timer = setTimeout(() => this.begin(), o.joinEndsAt - Date.now());
	}
	get open() {
		return this.startAt === 0 && !this.over;
	}
	get running() {
		return this.startAt !== 0 && !this.over;
	}
	invite() {
		let { id, hostName, buyIn, start, joinEndsAt } = this.o;
		return {
			id,
			hostName,
			buyIn,
			start,
			joinEndsAt
		};
	}
	view() {
		return {
			...this.invite(),
			host: this.o.host,
			finish: this.o.finish,
			pot: this.purse.pot,
			startAt: this.startAt,
			racers: [...this.racers].map(([id, name]) => ({
				id,
				name
			}))
		};
	}
	join(source, name) {
		if (!this.open) return "RACE_ERR_CLOSED";
		if (this.racers.size >= this.o.maxRacers) return "RACE_ERR_FULL";
		if (!this.purse.take(source)) return "RACE_ERR_MONEY";
		for (let other of this.racers.keys()) emitNet(EVENTS.racer, other, {
			id: source,
			name
		}, this.purse.pot);
		return this.racers.set(source, name), this.invited.delete(source), emitNet(EVENTS.state, source, this.view(), Date.now()), aiLog("races", `joined race ${this.o.id}`, {
			source,
			metadata: {
				buyIn: this.o.buyIn,
				pot: this.purse.pot
			}
		}), null;
	}
	leave(source) {
		if (!this.racers.has(source)) return;
		if (this.open && source === this.o.host) return this.cancel("RACE_CANCELLED_HOST");
		let refund = this.open;
		this.remove(source, refund), notify(source, refund ? Locale("RACE_LEFT_REFUND", money(this.o.buyIn)) : Locale("RACE_LEFT_LOST"), refund ? "info" : "error"), this.racers.size === 0 && this.end();
	}
	begin() {
		if (!this.open) return "RACE_ERR_CLOSED";
		clearTimeout(this.timer), this.uninviteAll();
		for (let source of this.racers.keys()) isNear(source, this.o.start, this.o.readyRadius) && driving(source) || (this.remove(source, !0), notify(source, Locale("RACE_NOT_READY", money(this.o.buyIn)), "error"));
		if (this.racers.size < 2) return this.cancel("RACE_CANCELLED_EMPTY"), null;
		let now = Date.now();
		this.startAt = now + COUNTDOWN_MS;
		for (let source of this.racers.keys()) this.samples.set(source, sampleOf(source, now));
		for (let source of this.racers.keys()) emitNet(EVENTS.start, source, this.startAt, now);
		return this.timer = setTimeout(() => this.timeout(), COUNTDOWN_MS + this.o.maxMs), aiLog("races", `race ${this.o.id} started`, { metadata: {
			racers: this.racers.size,
			pot: this.purse.pot
		} }), maybeAlertPolice(this.o.alertChance, this.o.start, this.racers.size, this.racers.keys().next().value), null;
	}
	sample(now) {
		if (this.running) for (let source of this.racers.keys()) this.moveHolds(source, now);
	}
	moveHolds(source, now) {
		let last = this.samples.get(source), next = last ? sampleHolds(source, last, now) : sampleOf(source, now);
		return next ? (this.samples.set(source, next), !0) : (aiLog("races", `disqualified from race ${this.o.id}: moved too fast`, {
			level: "warn",
			source,
			metadata: {
				from: last,
				to: sampleOf(source, now)
			}
		}), this.remove(source, !1), notify(source, Locale("RACE_DISQUALIFIED"), "error"), this.racers.size === 0 && this.end(), !1);
	}
	finish(source) {
		if (!this.racers.has(source) || this.over || this.startAt === 0) return !1;
		let now = Date.now();
		if (!this.moveHolds(source, now)) return !1;
		let elapsed = now - this.startAt;
		if (!finishHolds(source, this.o, elapsed)) return !1;
		let pot = this.purse.takeAll();
		this.purse.pay(source, pot, "streetrace:won");
		let name = this.racers.get(source) ?? "";
		for (let racer of this.racers.keys()) notify(racer, racer === source ? Locale("RACE_WON", money(pot)) : Locale("RACE_LOST", name, money(pot)), racer === source ? "success" : "info", 8e3);
		return aiLog("races", `race ${this.o.id} won`, {
			source,
			metadata: {
				pot,
				ms: elapsed
			}
		}), this.end(), !0;
	}
	cancel(key) {
		if (!this.over) {
			for (let source of this.racers.keys()) this.purse.refund(source), notify(source, Locale(key, money(this.o.buyIn)), "info");
			this.end();
		}
	}
	timeout() {
		if (this.over) return;
		let share = Math.floor(this.purse.takeAll() / this.racers.size);
		for (let source of this.racers.keys()) this.purse.pay(source, share, "streetrace:split"), notify(source, Locale("RACE_TIMEOUT", money(share)), "info");
		this.end();
	}
	remove(source, refund) {
		this.racers.delete(source), this.samples.delete(source), refund && this.purse.refund(source), this.hooks.out(source), emitNet(EVENTS.ended, source);
		for (let other of this.racers.keys()) emitNet(EVENTS.racerLeft, other, source, this.purse.pot);
	}
	uninviteAll() {
		for (let source of this.invited) emitNet(EVENTS.uninvite, source, this.o.id);
		this.invited.clear();
	}
	end() {
		let forfeited = this.purse.takeAll();
		forfeited > 0 && aiLog("races", `race ${this.o.id} ended with buy-ins forfeited`, { metadata: { forfeited } }), this.over = !0, clearTimeout(this.timer), this.uninviteAll();
		for (let source of this.racers.keys()) this.hooks.out(source), emitNet(EVENTS.ended, source);
		this.racers.clear(), this.samples.clear(), this.hooks.ended(this);
	}
}, Races = class {
	settings;
	byId = new Map();
	byRacer = new Map();
	nextId = 1;
	sampler = every(2e3, () => {
		let now = Date.now();
		for (let race of this.byId.values()) race.sample(now);
	}, {
		active: !1,
		name: "race positions"
	});
	hooks = {
		out: (source) => this.byRacer.delete(source),
		ended: (race) => {
			this.byId.delete(race.o.id), this.byId.size === 0 && this.sampler.set(!1);
		}
	};
	constructor(settings) {
		this.settings = settings;
	}
	of(source) {
		return this.byRacer.get(source);
	}
	create(source, buyIn, finish) {
		let s = this.settings.value;
		if (this.byRacer.has(source)) return "RACE_ERR_ALREADY";
		if (buyIn < s.minBuyIn || buyIn > s.maxBuyIn) return "RACE_ERR_BUYIN";
		if (!driving(source)) return "RACE_ERR_VEHICLE";
		let start = coordsOf(source);
		if (flatDistance(start, finish) < s.minDistance) return "RACE_ERR_SHORT";
		let race = new StreetRace({
			id: this.nextId++,
			host: source,
			hostName: online.name(source),
			start,
			finish,
			buyIn,
			account: s.account,
			joinEndsAt: Date.now() + s.joinSeconds * 1e3,
			maxMs: s.maxMinutes * 6e4,
			maxRacers: s.maxRacers,
			readyRadius: s.inviteRadius + 25,
			alertChance: s.alertChance
		}, this.hooks), error = race.join(source, race.o.hostName);
		if (error) return race.cancel("RACE_CANCELLED_EMPTY"), error;
		this.byId.set(race.o.id, race), this.byRacer.set(source, race), this.sampler.set(!0);
		let now = Date.now();
		for (let other of playersNear(source, s.inviteRadius)) other === source || this.byRacer.has(other) || online.character(other) && (race.invited.add(other), emitNet(EVENTS.invite, other, race.invite(), now));
		return notify(source, Locale("RACE_CREATED", race.invited.size, s.joinSeconds), "success", 6e3), null;
	}
	join(source, id) {
		if (this.byRacer.has(source)) return "RACE_ERR_ALREADY";
		let race = this.byId.get(id);
		return race?.open ? race.invited.has(source) ? isNear(source, race.o.start, race.o.readyRadius) ? driving(source) ? race.join(source, online.name(source)) || (this.byRacer.set(source, race), null) : "RACE_ERR_VEHICLE" : "RACE_ERR_FAR" : "RACE_ERR_INVITE" : "RACE_ERR_CLOSED";
	}
	begin(source) {
		let race = this.byRacer.get(source);
		return !race?.open || race.o.host !== source ? "RACE_ERR_HOST" : race.racers.size < 2 ? "RACE_ERR_ALONE" : race.begin();
	}
	unloaded(source) {
		this.byRacer.get(source)?.leave(source);
		for (let race of this.byId.values()) race.invited.delete(source);
	}
	cancelAll() {
		for (let race of this.byId.values()) race.cancel("RACE_CANCELLED_STOP");
	}
};
// resource/server/index.ts
const panel = new AdminPanel({
	title: "ADMIN_TITLE",
	icon: "flag-checkered",
	files: { settings: {
		kind: "settings",
		sync: "all",
		sections: {
			account: {
				type: "text",
				lookup: "account",
				min: 2,
				max: 32
			},
			minBuyIn: {
				type: "number",
				min: 0,
				max: 1e7,
				integer: !0
			},
			maxBuyIn: {
				type: "number",
				min: 0,
				max: 1e7,
				integer: !0
			},
			joinSeconds: {
				type: "number",
				min: 15,
				max: 300,
				integer: !0
			},
			maxRacers: {
				type: "number",
				min: 2,
				max: 16,
				integer: !0
			},
			inviteRadius: {
				type: "number",
				min: 10,
				max: 400,
				integer: !0
			},
			minDistance: {
				type: "number",
				min: 100,
				max: 1e4,
				integer: !0
			},
			maxMinutes: {
				type: "number",
				min: 1,
				max: 60,
				integer: !0
			},
			alertChance: {
				type: "number",
				min: 0,
				max: 100,
				integer: !0
			}
		},
		defaults: { ...DEFAULT_SETTINGS }
	} },
	tabs: [{
		id: "settings",
		file: "settings",
		icon: "sliders",
		label: "ADMIN_TAB_SETTINGS",
		desc: "ADMIN_TAB_SETTINGS_DESC",
		cards: [
			{
				icon: "money-bill-wave",
				title: "ADMIN_C_MONEY",
				desc: "ADMIN_C_MONEY_DESC",
				fields: [
					{
						widget: "text",
						lookup: "account",
						path: "account",
						label: "ADMIN_F_ACCOUNT",
						hint: "ADMIN_H_ACCOUNT",
						placeholder: "ADMIN_P_ACCOUNT"
					},
					{
						widget: "number",
						path: "minBuyIn",
						label: "ADMIN_F_MIN_BUYIN",
						hint: "ADMIN_H_MIN_BUYIN",
						min: 0,
						max: 1e7,
						unit: "$"
					},
					{
						widget: "number",
						path: "maxBuyIn",
						label: "ADMIN_F_MAX_BUYIN",
						hint: "ADMIN_H_MAX_BUYIN",
						min: 0,
						max: 1e7,
						unit: "$"
					}
				]
			},
			{
				icon: "flag-checkered",
				title: "ADMIN_C_RACES",
				desc: "ADMIN_C_RACES_DESC",
				fields: [
					{
						widget: "number",
						path: "joinSeconds",
						label: "ADMIN_F_JOIN_TIME",
						hint: "ADMIN_H_JOIN_TIME",
						min: 15,
						max: 300,
						unit: "s"
					},
					{
						widget: "number",
						path: "maxRacers",
						label: "ADMIN_F_MAX_RACERS",
						hint: "ADMIN_H_MAX_RACERS",
						min: 2,
						max: 16
					},
					{
						widget: "number",
						path: "inviteRadius",
						label: "ADMIN_F_INVITE_RADIUS",
						hint: "ADMIN_H_INVITE_RADIUS",
						min: 10,
						max: 400,
						unit: "m"
					},
					{
						widget: "number",
						path: "minDistance",
						label: "ADMIN_F_MIN_DISTANCE",
						hint: "ADMIN_H_MIN_DISTANCE",
						min: 100,
						max: 1e4,
						unit: "m"
					},
					{
						widget: "number",
						path: "maxMinutes",
						label: "ADMIN_F_MAX_TIME",
						hint: "ADMIN_H_MAX_TIME",
						min: 1,
						max: 60,
						unit: "min"
					}
				]
			},
			{
				icon: "triangle-exclamation",
				title: "ADMIN_C_POLICE",
				desc: "ADMIN_C_POLICE_DESC",
				fields: [{
					widget: "number",
					path: "alertChance",
					label: "ADMIN_F_ALERT_CHANCE",
					hint: "ADMIN_H_ALERT_CHANCE",
					min: 0,
					max: 100,
					unit: "%"
				}]
			}
		]
	}]
}), settings = panel.view("settings", readSettings);
panel.rule("settings", (_key, next) => {
	let s = record(next);
	return typeof s.minBuyIn == "number" && typeof s.maxBuyIn == "number" && s.minBuyIn > s.maxBuyIn ? "ADMIN_ERR_BUYIN_RANGE" : null;
}), aiLogChannels({ races: {} });
const races = new Races(settings);
onCharacter({ unloaded: (source) => races.unloaded(source) }), onStop(() => races.cancelAll());
const answer = (error) => error ? fail(error) : { ok: !0 };
onClientCallback(EVENTS.create, {
	args: ([buyIn, x, y]) => {
		let amount = readInt(buyIn, 0, 1e7), fx = readCoord(x), fy = readCoord(y);
		return amount === null || fx === null || fy === null ? null : [
			amount,
			fx,
			fy
		];
	},
	guards: [hasCharacter()],
	lock: !0,
	rate: {
		count: 2,
		windowMs: 5e3
	}
}, (source, buyIn, x, y) => answer(races.create(source, buyIn, {
	x,
	y
}))), onClientCallback(EVENTS.join, {
	args: oneArg(readId),
	guards: [hasCharacter()],
	lock: !0
}, (source, id) => answer(races.join(source, id))), onClientCallback(EVENTS.leave, (source) => {
	let race = races.of(source);
	return race ? (race.leave(source), { ok: !0 }) : fail("RACE_ERR_NONE");
}, { lock: !0 }), onClientCallback(EVENTS.begin, (source) => answer(races.begin(source)), { lock: !0 }), onClientCallback(EVENTS.finish, (source) => races.of(source)?.finish(source) ? { ok: !0 } : fail("RACE_ERR_FINISH"), {
	lock: !0,
	rate: {
		count: 4,
		windowMs: 2e3
	}
}), addCommand("race", { help: Locale("COMMAND_RACE_HELP") }, (source) => {
	source > 0 && emitNet(EVENTS.openMenu, source);
});
