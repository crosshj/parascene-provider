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
			prompt: {
				label: 'Prompt (optional)',
				type: 'text',
				required: false,
			},
		},
	},
};

const CONTROLS_STORAGE_KEY = 'parascene_generation_controls';
let _currentMethodKey = null;

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
	try {
		localStorage.setItem(CONTROLS_STORAGE_KEY, JSON.stringify(state));
	} catch {}
}

function saveCurrentMethodStateToStorage() {
	if (!_currentMethodKey) return;
	const state = loadGenerationControls();
	state.methods = state.methods || {};
	state.methods[_currentMethodKey] = getCurrentFieldValues(_currentMethodKey);
	try {
		localStorage.setItem(CONTROLS_STORAGE_KEY, JSON.stringify(state));
	} catch {}
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

			let input;
			if (fieldDef.type === 'text') {
				input = document.createElement('textarea');
				input.rows = 3;
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
			// Restore saved value for this method
			const saved = loadGenerationControls();
			const savedForMethod = saved.methods?.[methodKey];
			if (savedForMethod && fieldName in savedForMethod) {
				if (fieldDef.type === 'boolean') {
					const v = savedForMethod[fieldName];
					input.checked = v === true || v === 'true';
				} else if (savedForMethod[fieldName] !== '') {
					input.value = savedForMethod[fieldName];
				}
			}
			input.addEventListener('change', saveGenerationControls);
			input.addEventListener('input', saveGenerationControls);
			formGroup.appendChild(input);

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

			fieldGroup.appendChild(formGroup);
		}

		fieldsDiv.appendChild(fieldGroup);
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
	const args = {};
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

	// Advanced generate: send mock items from API (test fixture in place); prompt comes from the form
	if (methodKey === 'advanced_generate') {
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

	const imagePanel = document.getElementById('generationImageColumn');
	const generateBtn = document.getElementById('generateBtn');
	if (generateBtn) generateBtn.disabled = true;

	// Left panel: loading
	if (imagePanel) {
		imagePanel.classList.remove('has-content');
		imagePanel.innerHTML = '<div class="image-loading">Generating image…</div>';
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
			return;
		}

		const blob = await response.blob();
		const imageUrl = URL.createObjectURL(blob);

		if (imagePanel) {
			imagePanel.classList.add('has-content');
			imagePanel.innerHTML = `<img id="imageResult" src="${imageUrl}" alt="Generated image" />`;
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

// Expose functions globally for inline event handlers
window.fetchCapabilities = fetchCapabilities;
window.toggleJson = toggleJson;
window.updateMethodFields = updateMethodFields;
window.generateImage = generateImage;
