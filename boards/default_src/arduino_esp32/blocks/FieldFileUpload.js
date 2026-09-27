import * as Blockly from 'blockly/core';

/**
 * Custom Blockly field for file upload (model + labels).
 * Renders as a clickable button that triggers a hidden file input.
 */
export class FieldFileUpload extends Blockly.Field {
    constructor(opt_value, opt_validator) {
        super(opt_value, opt_validator);
        this.SERIALIZABLE = true;
    }

    initView() {
        this.createBorderRect_();
        this.borderRect_.style.fill = '#e0e0e0';
        this.borderRect_.style.rx = 4;
        this.borderRect_.style.cursor = 'pointer';

        this.textElement_ = Blockly.utils.dom.createSvgElement(
            Blockly.utils.Svg.TEXT,
            {
                'class': 'blocklyText',
                'x': 8,
                'y': 12,
                'dominant-baseline': 'middle'
            },
            this.fieldGroup_
        );
        this.updateDisplay_();
    }

    updateDisplay_() {
        const text = this.getValue() || 'Click to upload model';
        if (this.textElement_) {
            this.textElement_.textContent = text;
        }
    }

    getSize() {
        return new Blockly.utils.Size(180, 28);
    }

    showEditor_() {
        // Model file picker
        const modelInput = document.createElement('input');
        modelInput.type = 'file';
        modelInput.accept = '.tflite';
        modelInput.style.display = 'none';

        modelInput.addEventListener('change', (e) => {
            const file = e.target.files[0];
            if (!file) return;

            const reader = new FileReader();
            reader.onload = (ev) => {
                // Store model data in global scope
                if (!window.__mixly_tflite) {
                    window.__mixly_tflite = { modelData: null, labelsText: null, modelFileName: null };
                }
                window.__mixly_tflite.modelData = new Uint8Array(ev.target.result);
                window.__mixly_tflite.modelFileName = file.name;

                this.setValue(file.name + ' (' + (file.size / 1024).toFixed(1) + ' KB)');

                // Now prompt for labels.txt
                this.showLabelsPicker_();
            };
            reader.readAsArrayBuffer(file);
        });

        document.body.appendChild(modelInput);
        modelInput.click();
        document.body.removeChild(modelInput);
    }

    showLabelsPicker_() {
        const labelsInput = document.createElement('input');
        labelsInput.type = 'file';
        labelsInput.accept = '.txt';
        labelsInput.style.display = 'none';

        labelsInput.addEventListener('change', (e) => {
            const file = e.target.files[0];
            if (!file) return;

            const reader = new FileReader();
            reader.onload = (ev) => {
                window.__mixly_tflite.labelsText = ev.target.result;
                const current = this.getValue() || '';
                this.setValue(current + ' + labels');
            };
            reader.readAsText(file);
        });

        document.body.appendChild(labelsInput);
        labelsInput.click();
        document.body.removeChild(labelsInput);
    }

    static fromJson(options) {
        return new FieldFileUpload(options && options['value']);
    }
}

Blockly.fieldRegistry.register('field_file_upload', FieldFileUpload);
