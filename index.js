let capabilities = null;

/** Cached mock items for advanced_generate (fetched from API, which uses test/fixtures/advanced.items.js). */
let advancedMockItemsCache = null;

/** Special methods not in GET capabilities; always available in UI for testing. */
const SPECIAL_METHODS = {
	advanced_query: {
		name: 'Advanced Query (special)',
		credits: undefined,
		fields: {},
	},
	advanced_generate: {
		name: 'Advanced Generate (special)',
		credits: undefined,
		fields: {
			operation: {
				label: 'Operation',
				type: 'select',
				required: true,
				default: 'generate',
				options: [
					{ value: 'generate', label: 'Generate from items (Flux 2 Pro)' },
					{ value: 'generate_thumb', label: 'Generate 999×999 (Flux 2 Pro)' },
					{ value: 'outpaint', label: 'Outpaint 1024→16:9 (Flux Pro Fill)' },
				],
			},
			prompt: {
				label: 'Prompt (optional)',
				type: 'text',
				required: false,
			},
			image_url: {
				label: 'Image URL (for outpaint)',
				type: 'url',
				required: false,
			},
		},
	},
};

const CONTROLS_STORAGE_KEY = 'parascene_generation_controls';
let _currentMethodKey = null;
let _currentAsyncJobId = null;

/** Defaults for Replicate method in the test harness when not provided by API (e.g. prompt has no default in generationMethods). */
const REPLICATE_DEFAULTS = {
	prompt: 'A lone knight stands upon a battlefield drowned in silence, his armor scarred and his blade heavy with blood. From the corpses of his slain foes rise shadowy spirits—vengeful shades that coil and writhe like living smoke. Their hollow eyes burn with hatred, their twisted forms clawing at the knight, covering him in a shroud of darkness. The air trembles with their whispers of vengeance, a chorus of rage that binds him to the weight of his triumph. Lightning splits the storm-choked sky, illuminating the knight as both conqueror and cursed, a figure draped in the wrathful shadows of the souls he has condemned.',
};

function loadGenerationControls() {
	try {
		const raw = localStorage.getItem(CONTROLS_STORAGE_KEY);
		if (!raw) return {};
		const data = JSON.parse(raw);
		return data && typeof data === 'object' ? data : {};
	} catch {
		return {};
	}
}

function saveAsyncStateForMethod(methodKey) {
	if (!methodKey) return;
	const asyncCheckbox = document.getElementById('asyncToggle');
	const isAsyncChecked =
		asyncCheckbox && asyncCheckbox instanceof HTMLInputElement
			? asyncCheckbox.checked
			: false;
	const state = loadGenerationControls();
	state.asyncMethods = state.asyncMethods || {};
	state.asyncMethods[methodKey] = isAsyncChecked;
	try {
		localStorage.setItem(CONTROLS_STORAGE_KEY, JSON.stringify(state));
	} catch { }
}

function getCurrentFieldValues(methodKeyToRead) {
	if (!methodKeyToRead || !capabilities?.methods?.[methodKeyToRead]) return {};
	const method = capabilities.methods[methodKeyToRead];
	const fields = method.fields || {};
	const values = {};
	for (const fieldName of Object.keys(fields)) {
		const input =
			document.getElementById(`field_${fieldName}`) ||
			document.querySelector(`[name="${fieldName}"]`);
		if (!input) continue;
		const fieldDef = fields[fieldName];
		if (fieldDef?.type === 'boolean') {
			values[fieldName] = input.checked;
		} else if ('value' in input) {
			values[fieldName] = input.value;
		}
	}
	return values;
}

function saveGenerationControls() {
	const methodSelect = document.getElementById('method');
	const methodKey = methodSelect?.value;
	if (!methodKey || !capabilities?.methods?.[methodKey]) return;

	const state = loadGenerationControls();
	state.selectedMethod = methodKey;
	state.methods = state.methods || {};
	state.methods[methodKey] = getCurrentFieldValues(methodKey);
	// Also persist async toggle state per method (if present)
	const asyncCheckbox = document.getElementById('asyncToggle');
	if (asyncCheckbox && asyncCheckbox instanceof HTMLInputElement) {
		state.asyncMethods = state.asyncMethods || {};
		state.asyncMethods[methodKey] = asyncCheckbox.checked;
	}
	try {
		localStorage.setItem(CONTROLS_STORAGE_KEY, JSON.stringify(state));
	} catch { }
}

function saveCurrentMethodStateToStorage() {
	if (!_currentMethodKey) return;
	const state = loadGenerationControls();
	state.methods = state.methods || {};
	state.methods[_currentMethodKey] = getCurrentFieldValues(_currentMethodKey);
	// Persist async toggle for the previous method as well
	const asyncCheckbox = document.getElementById('asyncToggle');
	if (asyncCheckbox && asyncCheckbox instanceof HTMLInputElement) {
		state.asyncMethods = state.asyncMethods || {};
		state.asyncMethods[_currentMethodKey] = asyncCheckbox.checked;
	}
	try {
		localStorage.setItem(CONTROLS_STORAGE_KEY, JSON.stringify(state));
	} catch { }
}

// Load saved token on page load
window.addEventListener('DOMContentLoaded', () => {
	const savedToken = localStorage.getItem('parascene_api_token');
	if (savedToken) {
		document.getElementById('authToken').value = savedToken;
		// Automatically fetch capabilities with saved token
		fetchCapabilities();
	}

	// Save token on input
	document.getElementById('authToken').addEventListener('input', (e) => {
		localStorage.setItem('parascene_api_token', e.target.value);
	});
});

function toggleJson(toggle) {
	toggle.classList.toggle('expanded');
	const content = toggle.nextElementSibling;
	content.classList.toggle('expanded');
}

async function fetchCapabilities() {
	const token = document.getElementById('authToken').value;
	const resultDiv = document.getElementById('getResult');

	if (!token) {
		resultDiv.innerHTML = '<div class="error">Please enter an API token</div>';
		return;
	}

	resultDiv.innerHTML = '<p>Fetching...</p>';

	try {
		const response = await fetch('/api', {
			method: 'GET',
			headers: {
				Authorization: `Bearer ${token}`,
			},
		});

		const data = await response.json();

		if (!response.ok) {
			resultDiv.innerHTML = `<div class="error">Error ${response.status}: ${data.message || data.error}</div>`;
			return;
		}

		capabilities = { ...data, methods: { ...data.methods, ...SPECIAL_METHODS } };
		resultDiv.innerHTML = `
			<div class="success">✓ Authenticated successfully</div>
			<div class="json-toggle" onclick="toggleJson(this)">Capabilities JSON Response</div>
			<div class="json-content"><pre>${JSON.stringify(data, null, 2)}</pre></div>
		`;

		// Populate method dropdown (includes special methods for testing)
		const methodSelect = document.getElementById('method');
		methodSelect.innerHTML = '<option value="">Select a method...</option>';
		const methodKeys = Object.keys(capabilities.methods);
		for (const [key, method] of Object.entries(capabilities.methods)) {
			const option = document.createElement('option');
			option.value = key;
			option.textContent =
				key in SPECIAL_METHODS ? method.name : `${method.name} (${method.credits} credits)`;
			methodSelect.appendChild(option);
		}

		// Restore saved method if valid, else first
		const saved = loadGenerationControls();
		if (methodKeys.length > 0) {
			const preferred = saved.selectedMethod && methodKeys.includes(saved.selectedMethod)
				? saved.selectedMethod
				: methodKeys[0];
			methodSelect.value = preferred;
			updateMethodFields();
		}

		// Show generation section
		document.getElementById('generationSection').style.display = 'block';
	} catch (error) {
		resultDiv.innerHTML = `<div class="error">Error: ${error.message}</div>`;
	}
}

function updateMethodFields() {
	const methodSelect = document.getElementById('method');
	const methodKey = methodSelect?.value;
	const fieldsDiv = document.getElementById('methodFields');
	const generateBtn = document.getElementById('generateBtn');

	if (!methodKey || !capabilities?.methods) {
		fieldsDiv.innerHTML = '';
		generateBtn.disabled = true;
		return;
	}

	// Save previous method's field values before rebuilding (so switching method doesn't lose the old method's values)
	if (_currentMethodKey) {
		saveCurrentMethodStateToStorage();
	}

	const method = capabilities.methods[methodKey];
	fieldsDiv.innerHTML = '';

	if (method.description) {
		const desc = document.createElement('p');
		desc.style.color = '#616e7c';
		desc.style.marginBottom = '16px';
		desc.textContent = method.description;
		fieldsDiv.appendChild(desc);
	}

	const fields = method.fields || {};
	if (Object.keys(fields).length > 0) {
		const fieldGroup = document.createElement('div');
		fieldGroup.className = 'field-group';

		for (const [fieldName, fieldDef] of Object.entries(fields)) {
			const formGroup = document.createElement('div');
			formGroup.className = 'form-group';
			formGroup.style.marginBottom = '12px';

			const label = document.createElement('label');
			label.textContent = `${fieldDef.label}${fieldDef.required ? ' *' : ''}`;
			formGroup.appendChild(label);
			if (fieldDef.hint) {
				const hintEl = document.createElement('span');
				hintEl.className = 'field-hint';
				hintEl.style.display = 'block';
				hintEl.style.fontSize = '0.85em';
				hintEl.style.color = '#6b7280';
				hintEl.style.marginTop = '2px';
				hintEl.style.marginBottom = '4px';
				hintEl.textContent = fieldDef.hint;
				formGroup.appendChild(hintEl);
			}

			let input;
			if (fieldDef.type === 'text' || fieldDef.type === 'json-object' || fieldDef.type === 'image_url_array') {
				input = document.createElement('textarea');
				const isJsonField = fieldDef.type === 'json-object' || (fieldDef.label && String(fieldDef.label).includes('JSON'));
				input.rows = isJsonField ? 6 : 3;
			} else if (fieldDef.type === 'url') {
				input = document.createElement('input');
				input.type = 'url';
				input.autocapitalize = 'off';
				input.autocomplete = 'off';
				input.spellcheck = false;
			} else if (fieldDef.type === 'color') {
				input = document.createElement('input');
				input.type = 'color';
			} else if (fieldDef.type === 'select') {
				input = document.createElement('select');
				const options = fieldDef.options || [];
				for (const opt of options) {
					const option = document.createElement('option');
					option.value = opt.value;
					option.textContent =
						typeof opt.credits === 'number'
							? `${opt.label} (${opt.credits} credits)`
							: opt.label;
					input.appendChild(option);
				}
				if (fieldDef.default != null && fieldDef.default !== '') {
					input.value = String(fieldDef.default);
				} else if (options.length > 0) {
					input.value = String(options[0].value);
				}
			} else if (fieldDef.type === 'boolean') {
				input = document.createElement('input');
				input.type = 'checkbox';
				input.checked = fieldDef.default === true || fieldDef.default === 'true';
			} else {
				input = document.createElement('input');
				input.type = 'text';
			}
			input.id = `field_${fieldName}`;
			input.name = fieldName;
			if (fieldDef.type !== 'select' && fieldDef.type !== 'boolean') {
				input.placeholder = fieldDef.required ? 'Required' : 'Optional';
			}
			// Restore saved value for this method, or apply default for text/textarea/json-object
			const saved = loadGenerationControls();
			const savedForMethod = saved.methods?.[methodKey];
			if (savedForMethod && fieldName in savedForMethod) {
				if (fieldDef.type === 'boolean') {
					const v = savedForMethod[fieldName];
					input.checked = v === true || v === 'true';
				} else if (savedForMethod[fieldName] !== '' && savedForMethod[fieldName] != null) {
					input.value = savedForMethod[fieldName];
				}
			}
			// Apply default when value is still empty (no saved value, or saved was empty)
			if ((input.value === '' || input.value === undefined) && (fieldDef.type === 'text' || fieldDef.type === 'url' || fieldDef.type === 'json-object') && fieldDef.default != null && fieldDef.default !== '') {
				input.value = typeof fieldDef.default === 'string' ? fieldDef.default : JSON.stringify(fieldDef.default, null, 2);
			} else if ((input.value === '' || input.value === undefined) && methodKey === 'replicate' && REPLICATE_DEFAULTS[fieldName] !== undefined) {
				input.value = String(REPLICATE_DEFAULTS[fieldName]);
			}
			input.addEventListener('change', saveGenerationControls);
			input.addEventListener('input', saveGenerationControls);
			formGroup.appendChild(input);

			// Select with option hints: show selected option's hint under the selector
			if (fieldDef.type === 'select' && fieldDef.options?.some((opt) => opt.hint)) {
				const selectHint = document.createElement('span');
				selectHint.className = 'field-hint';
				selectHint.style.display = 'block';
				selectHint.style.fontSize = '0.85em';
				selectHint.style.color = '#6b7280';
				selectHint.style.marginTop = '4px';
				const updateSelectHint = () => {
					const opt = fieldDef.options.find((o) => o.value === input.value);
					selectHint.textContent = opt?.hint ?? '';
				};
				updateSelectHint();
				input.addEventListener('change', updateSelectHint);
				formGroup.appendChild(selectHint);
			}

			// Nice UX for image_url fields: show a quick preview.
			if (fieldName === 'image_url') {
				const preview = document.createElement('img');
				preview.style.maxWidth = '100%';
				preview.style.marginTop = '8px';
				preview.style.display = 'none';

				input.addEventListener('input', () => {
					const v = input.value.trim();
					if (!v) {
						preview.removeAttribute('src');
						preview.style.display = 'none';
						return;
					}
					preview.src = v;
					preview.style.display = 'block';
				});

				formGroup.appendChild(preview);
			}

			// Advanced outpaint: show image_url only when operation is "outpaint"
			if (methodKey === 'advanced_generate' && fieldName === 'image_url') {
				formGroup.dataset.advancedOperation = 'outpaint';
				formGroup.style.display = 'none';
			}

			fieldGroup.appendChild(formGroup);
		}

		fieldsDiv.appendChild(fieldGroup);

		// Advanced generate: toggle image_url visibility by operation
		if (methodKey === 'advanced_generate') {
			const operationSelect = document.getElementById('field_operation') || fieldsDiv.querySelector('[name="operation"]');
			const imageUrlGroup = fieldsDiv.querySelector('[data-advanced-operation="outpaint"]');
			const updateOutpaintVisibility = () => {
				const op = operationSelect?.value;
				if (imageUrlGroup) {
					imageUrlGroup.style.display = op === 'outpaint' ? '' : 'none';
				}
			};
			updateOutpaintVisibility();
			operationSelect?.addEventListener('change', updateOutpaintVisibility);
		}
	}

	// Async toggle (manual polling) — only for methods that support async in config
	// Remove any existing async toggle before adding a new one
	const existingAsyncContainer = document.getElementById('asyncModeContainer');
	if (existingAsyncContainer) {
		existingAsyncContainer.remove();
	}

	if (method.async === true) {
		const asyncGroup = document.createElement('div');
		asyncGroup.id = 'asyncModeContainer';
		asyncGroup.className = 'form-group';
		asyncGroup.style.marginTop = '16px';

		const label = document.createElement('label');
		const checkbox = document.createElement('input');
		checkbox.type = 'checkbox';
		checkbox.id = 'asyncToggle';
		checkbox.style.marginRight = '6px';
		// Restore saved async state for this method, if any
		const saved = loadGenerationControls();
		const savedAsync =
			saved &&
			saved.asyncMethods &&
			Object.prototype.hasOwnProperty.call(saved.asyncMethods, methodKey)
				? !!saved.asyncMethods[methodKey]
				: false;
		checkbox.checked = savedAsync;
		label.appendChild(checkbox);
		label.appendChild(
			document.createTextNode('Async mode'),
		);
		asyncGroup.appendChild(label);

		const hint = document.createElement('div');
		hint.className = 'field-hint';
		hint.style.fontSize = '0.85em';
		hint.style.color = '#6b7280';
		hint.style.marginTop = '4px';
		hint.textContent =
			'When enabled, this method returns JSON with a job_id instead of an image/video. Use the Job ID field below to manually poll.';
		asyncGroup.appendChild(hint);

		// Optional Job ID input for polling existing async jobs (UI-only; not part of capabilities)
		const jobGroup = document.createElement('div');
		jobGroup.className = 'form-group';
		jobGroup.id = 'asyncJobGroup';
		jobGroup.style.marginTop = '8px';
		jobGroup.style.display = 'none';

		const jobLabel = document.createElement('label');
		jobLabel.textContent = 'Job ID (for polling existing async job)';
		jobGroup.appendChild(jobLabel);

		const jobInput = document.createElement('input');
		jobInput.type = 'text';
		jobInput.id = 'asyncJobId';
		jobInput.placeholder = 'Optional — paste job_id from previous async response to poll';
		jobInput.style.width = '100%';
		jobInput.style.marginTop = '4px';
		jobGroup.appendChild(jobInput);

		asyncGroup.appendChild(jobGroup);

		fieldsDiv.appendChild(asyncGroup);

		// Persist async state whenever the toggle changes
		checkbox.addEventListener('change', () => {
			saveAsyncStateForMethod(methodKey);
		});
	}

	// Reset async job state and poll button when switching methods
	_currentAsyncJobId = null;
	const pollBtn = document.getElementById('pollBtn');
	if (pollBtn) {
		pollBtn.style.display = 'none';
	}
	const jobGroup = document.getElementById('asyncJobGroup');
	if (jobGroup) {
		jobGroup.style.display = 'none';
		const jobInput = document.getElementById('asyncJobId');
		if (jobInput) {
			jobInput.value = '';
		}
	}

	_currentMethodKey = methodKey;
	generateBtn.disabled = false;
}

async function generateImage() {
	const token = document.getElementById('authToken').value;
	const methodKey = document.getElementById('method').value;

	if (!token || !methodKey) {
		const imagePanel = document.getElementById('generationImageColumn');
		if (imagePanel) {
			imagePanel.classList.remove('has-content');
			imagePanel.innerHTML = '<div class="error">Please select a method</div>';
		}
		return;
	}

	const method = capabilities?.methods?.[methodKey];
	if (!method) {
		const panel = document.getElementById('generationImageColumn');
		if (panel) {
			panel.classList.remove('has-content');
			panel.innerHTML = '<div class="error">Unknown method</div>';
		}
		return;
	}
	let args = {};
	const fieldsContainer = document.getElementById('methodFields');

	// Collect field values from inputs in the method form (by id or name so we always find them)
	for (const [fieldName, fieldDef] of Object.entries(method.fields || {})) {
		const input =
			document.getElementById(`field_${fieldName}`) ||
			(fieldsContainer && fieldsContainer.querySelector(`[name="${fieldName}"]`));
		if (!input) continue;
		if (fieldDef.type === 'boolean') {
			args[fieldName] = input.checked;
		} else if (fieldDef.type === 'select') {
			args[fieldName] = input.value ? String(input.value) : String(fieldDef.default ?? '');
		} else if (input.value) {
			args[fieldName] = input.value;
		}
	}

	// Normalize image_url_array fields: parse JSON into arrays
	for (const [fieldName, fieldDef] of Object.entries(method.fields || {})) {
		if (fieldDef.type !== 'image_url_array') continue;
		const current = args[fieldName];
		if (typeof current !== 'string') continue;
		const raw = current.trim();
		if (!raw) {
			delete args[fieldName];
			continue;
		}
		try {
			const parsed = JSON.parse(raw);
			if (Array.isArray(parsed)) {
				args[fieldName] = parsed;
			}
		} catch {
			// leave as-is; server-side will surface JSON errors
		}
	}

	// Advanced generate: by operation — outpaint needs image_url; generate needs mock items
	if (methodKey === 'advanced_generate') {
		if (args.operation === 'outpaint') {
			const imageUrl = (args.image_url || '').trim();
			if (!imageUrl) {
				if (imagePanel) {
					imagePanel.classList.remove('has-content');
					imagePanel.innerHTML = '<div class="error">Image URL is required for Outpaint</div>';
				}
				if (generateBtn) generateBtn.disabled = false;
				return;
			}
			// args already have image_url and prompt from form
		} else {
			let items = advancedMockItemsCache;
			if (!items) {
				const res = await fetch(`${window.location.origin}/api?mockItems=1`, {
					headers: { Authorization: `Bearer ${token}` },
				});
				if (!res.ok) {
					if (imagePanel) {
						imagePanel.classList.remove('has-content');
						imagePanel.innerHTML = `<div class="error">Failed to load mock items: ${res.status}</div>`;
					}
					if (generateBtn) generateBtn.disabled = false;
					return;
				}
				const data = await res.json();
				items = Array.isArray(data?.items) ? data.items : [];
				advancedMockItemsCache = items;
			}
			args.items = items;
		}
	}

	const imagePanel = document.getElementById('generationImageColumn');
	const generateBtn = document.getElementById('generateBtn');
	const pollBtn = document.getElementById('pollBtn');
	if (generateBtn) {
		generateBtn.disabled = true;
		// While generating (sync or starting async), hide the poll button
		generateBtn.style.display = '';
	}
	if (pollBtn) {
		pollBtn.style.display = 'none';
	}

	const asyncCheckbox = document.getElementById('asyncToggle');
	const asyncEnabled =
		Boolean(method.async) && asyncCheckbox && asyncCheckbox instanceof HTMLInputElement
			? asyncCheckbox.checked
			: false;

	// If async is enabled and a Job ID is provided (either from UI or stored), treat this call as a poll:
	// only send job_id and ignore other args for this request.
	if (asyncEnabled) {
		const jobInput = document.getElementById('asyncJobId');
		const manualJobId = jobInput && jobInput.value.trim();
		const effectiveJobId = manualJobId || _currentAsyncJobId;
		if (effectiveJobId) {
			args = { job_id: effectiveJobId };
		}
	}

	// Left panel: loading
	if (imagePanel) {
		imagePanel.classList.remove('has-content');
		if (asyncEnabled) {
			imagePanel.innerHTML =
				'<div class="image-loading">Starting async job… response will be JSON with job_id and polling info.</div>';
		} else {
			imagePanel.innerHTML = '<div class="image-loading">Generating image…</div>';
		}
	}

	try {
		const response = await fetch('/api', {
			method: 'POST',
			headers: {
				Authorization: `Bearer ${token}`,
				'Content-Type': 'application/json',
			},
			body: JSON.stringify({
				method: methodKey,
				args: args,
				async: asyncEnabled,
			}),
		});

		if (!response.ok) {
			const errData = await response.json().catch(() => ({}));
			if (imagePanel) {
				imagePanel.classList.remove('has-content');
				imagePanel.innerHTML = `<div class="error">Error ${response.status}: ${errData.message || errData.error || response.statusText}</div>`;
			}
			return;
		}

		const contentType = response.headers.get('Content-Type') || '';
		if (contentType.includes('application/json')) {
			const jsonData = await response.json();
			if (imagePanel) {
				imagePanel.classList.add('has-content');
				imagePanel.innerHTML = `<pre class="json-result">${JSON.stringify(jsonData, null, 2)}</pre>`;
			}

			// If this is an async job response with a job_id, update poll state
			if (method.async && jsonData && typeof jsonData === 'object') {
				const status = jsonData.status;
				const jobId = jsonData.job_id || jsonData.prediction_id;
				const isDone = status === 'succeeded' || status === 'failed' || status === 'canceled';

				if (jobId && !isDone) {
					// Job is in progress: enable poll-only mode
					_currentAsyncJobId = String(jobId);
					if (pollBtn) {
						pollBtn.style.display = '';
					}
					if (generateBtn) {
						generateBtn.style.display = 'none';
					}
					const jobGroup = document.getElementById('asyncJobGroup');
					if (jobGroup) {
						jobGroup.style.display = '';
					}
					const jobInput = document.getElementById('asyncJobId');
					if (jobInput && !jobInput.value.trim()) {
						jobInput.value = _currentAsyncJobId;
					}
				} else {
					// Job is done or failed: reset to generate-only mode
					_currentAsyncJobId = null;
					if (pollBtn) {
						pollBtn.style.display = 'none';
					}
					if (generateBtn) {
						generateBtn.style.display = '';
					}
					const jobGroup = document.getElementById('asyncJobGroup');
					if (jobGroup) {
						jobGroup.style.display = 'none';
						const jobInput = document.getElementById('asyncJobId');
						if (jobInput) {
							jobInput.value = '';
						}
					}
				}
			}
			return;
		}

		const blob = await response.blob();
		const objectUrl = URL.createObjectURL(blob);

		if (imagePanel) {
			imagePanel.classList.add('has-content');
			if (contentType.startsWith('video/')) {
				imagePanel.innerHTML = `
					<video
						id="videoResult"
						src="${objectUrl}"
						controls
						autoplay
						loop
					></video>
				`;
			} else {
				imagePanel.innerHTML = `<img id="imageResult" src="${objectUrl}" alt="Generated image" />`;
			}
		}
	} catch (error) {
		if (imagePanel) {
			imagePanel.classList.remove('has-content');
			imagePanel.innerHTML = `<div class="error">Error: ${error.message}</div>`;
		}
	} finally {
		if (generateBtn) generateBtn.disabled = false;
	}
}

async function pollAsyncJob() {
	const methodSelect = document.getElementById('method');
	const methodKey = methodSelect?.value;
	if (!methodKey || !capabilities?.methods?.[methodKey]) {
		return;
	}

	// Ensure async mode is enabled for polling
	const asyncCheckbox = document.getElementById('asyncToggle');
	if (asyncCheckbox && asyncCheckbox instanceof HTMLInputElement) {
		asyncCheckbox.checked = true;
	}

	// Prefer stored job id; if none, fall back to text field
	const jobInput = document.getElementById('asyncJobId');
	const manualJobId = jobInput && jobInput.value.trim();
	if (_currentAsyncJobId) {
		if (jobInput) jobInput.value = _currentAsyncJobId;
	} else if (manualJobId) {
		_currentAsyncJobId = manualJobId;
	} else {
		// Nothing to poll
		return;
	}

	// Reuse generateImage with async=true and job_id set, but switch buttons:
	// show Poll, hide Generate while polling.
	const generateBtn = document.getElementById('generateBtn');
	const pollBtn = document.getElementById('pollBtn');
	if (pollBtn) {
		pollBtn.disabled = true;
	}
	if (generateBtn) {
		generateBtn.style.display = 'none';
	}

	await generateImage();

	if (pollBtn) {
		pollBtn.disabled = false;
	}
}

// Expose functions globally for inline event handlers
window.fetchCapabilities = fetchCapabilities;
window.toggleJson = toggleJson;
window.updateMethodFields = updateMethodFields;
window.generateImage = generateImage;
window.pollAsyncJob = pollAsyncJob;
