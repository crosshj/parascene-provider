let capabilities = null;

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

		capabilities = data;
		resultDiv.innerHTML = `
			<div class="success">✓ Authenticated successfully</div>
			<div class="json-toggle" onclick="toggleJson(this)">Capabilities JSON Response</div>
			<div class="json-content"><pre>${JSON.stringify(data, null, 2)}</pre></div>
		`;

		// Populate method dropdown
		const methodSelect = document.getElementById('method');
		methodSelect.innerHTML = '<option value="">Select a method...</option>';
		const methodKeys = Object.keys(data.methods);
		for (const [key, method] of Object.entries(data.methods)) {
			const option = document.createElement('option');
			option.value = key;
			option.textContent = `${method.name} (${method.credits} credits)`;
			methodSelect.appendChild(option);
		}

		// Select first method by default
		if (methodKeys.length > 0) {
			methodSelect.value = methodKeys[0];
			updateMethodFields();
		}

		// Show generation section
		document.getElementById('generationSection').style.display = 'block';
	} catch (error) {
		resultDiv.innerHTML = `<div class="error">Error: ${error.message}</div>`;
	}
}

function updateMethodFields() {
	const methodKey = document.getElementById('method').value;
	const fieldsDiv = document.getElementById('methodFields');
	const generateBtn = document.getElementById('generateBtn');

	if (!methodKey || !capabilities) {
		fieldsDiv.innerHTML = '';
		generateBtn.disabled = true;
		return;
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
			} else {
				input = document.createElement('input');
				input.type = 'text';
			}
			input.id = `field_${fieldName}`;
			input.name = fieldName;
			if (fieldDef.type !== 'select') {
				input.placeholder = fieldDef.required ? 'Required' : 'Optional';
			}
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

	generateBtn.disabled = false;
}

async function generateImage() {
	const token = document.getElementById('authToken').value;
	const methodKey = document.getElementById('method').value;
	const resultDiv = document.getElementById('postResult');

	if (!token || !methodKey) {
		resultDiv.innerHTML = '<div class="error">Please select a method</div>';
		return;
	}

	const method = capabilities.methods[methodKey];
	const args = {};
	const fieldsContainer = document.getElementById('methodFields');

	// Collect field values from inputs in the method form (by id or name so we always find them)
	for (const [fieldName, fieldDef] of Object.entries(method.fields || {})) {
		const input =
			document.getElementById(`field_${fieldName}`) ||
			(fieldsContainer && fieldsContainer.querySelector(`[name="${fieldName}"]`));
		if (!input) continue;
		// Selects always have a value; send it (or default). Other fields: send when non-empty.
		if (fieldDef.type === 'select') {
			args[fieldName] = input.value ? String(input.value) : String(fieldDef.default ?? '');
		} else if (input.value) {
			args[fieldName] = input.value;
		}
	}

	resultDiv.innerHTML = '<p>Generating image...</p>';

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
			const data = await response.json();
			resultDiv.innerHTML = `<div class="error">Error ${response.status}: ${data.message || data.error}</div>`;
			return;
		}

		// Display the image
		const blob = await response.blob();
		const imageUrl = URL.createObjectURL(blob);

		const width = response.headers.get('X-Image-Width');
		const height = response.headers.get('X-Image-Height');
		const color = response.headers.get('X-Image-Color');

		resultDiv.innerHTML = `
			<div class="success">✓ Image generated successfully</div>
			<p>Dimensions: ${width}x${height}${color ? ` | Color: ${color}` : ''}</p>
			<img id="imageResult" src="${imageUrl}" alt="Generated image" />
		`;
	} catch (error) {
		resultDiv.innerHTML = `<div class="error">Error: ${error.message}</div>`;
	}
}

// Expose functions globally for inline event handlers
window.fetchCapabilities = fetchCapabilities;
window.toggleJson = toggleJson;
window.updateMethodFields = updateMethodFields;
window.generateImage = generateImage;
