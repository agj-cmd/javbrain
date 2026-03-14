const vscode = require('vscode');

/**
 * @param {vscode.ExtensionContext} context
 */
function activate(context) {
    const command = vscode.commands.registerCommand('hslAdjust.run', async () => {
        const editor = vscode.window.activeTextEditor;
        if (!editor) {
            vscode.window.showErrorMessage('No active editor');
            return;
        }

        const selection = editor.selection;
        if (selection.isEmpty) {
            vscode.window.showErrorMessage('No text selected');
            return;
        }

        const text = editor.document.getText(selection);

        // Sequential inputs
        const hInput = await vscode.window.showInputBox({
            prompt: 'Hue shift (-180 to 180)',
            placeHolder: 'blank = no change'
        });
        if (hInput === undefined) return;

        const sInput = await vscode.window.showInputBox({
            prompt: 'Saturation shift (-100 to 100)',
            placeHolder: 'blank = no change'
        });
        if (sInput === undefined) return;

        const lInput = await vscode.window.showInputBox({
            prompt: 'Lightness shift (-100 to 100)',
            placeHolder: 'blank = no change'
        });
        if (lInput === undefined) return;

        const aInput = await vscode.window.showInputBox({
            prompt: 'Alpha shift (-100 to 100, or absolute 0-100 with "=")',
            placeHolder: 'blank = no change'
        });
        if (aInput === undefined) return;

        const h = parseInput(hInput);
        const s = parseInput(sInput);
        const l = parseInput(lInput);
        const a = parseAlphaInput(aInput);

        // Match all hex formats: #rgb, #rgba, #rrggbb, #rrggbbaa
        const hexPattern = /#(?:[0-9a-fA-F]{8}|[0-9a-fA-F]{6}|[0-9a-fA-F]{4}|[0-9a-fA-F]{3})\b/gi;

        const result = text.replace(hexPattern, (hex) => {
            return adjustHex(hex, h, s, l, a);
        });

        await editor.edit(builder => {
            builder.replace(selection, result);
        });

        const aStr = a.absolute ? `=${a.value}` : (a.value >= 0 ? `+${a.value}` : `${a.value}`);
        vscode.window.showInformationMessage(
            `Adjusted colors: H${h >= 0 ? '+' : ''}${h} S${s >= 0 ? '+' : ''}${s} L${l >= 0 ? '+' : ''}${l} A${aStr}`
        );
    });

    context.subscriptions.push(command);
}

function parseInput(val) {
    if (!val || val.trim() === '') return 0;
    const num = parseInt(val, 10);
    return isNaN(num) ? 0 : num;
}

function parseAlphaInput(val) {
    if (!val || val.trim() === '') return { value: 0, absolute: false };
    const trimmed = val.trim();
    if (trimmed.startsWith('=')) {
        const num = parseInt(trimmed.slice(1), 10);
        return { value: isNaN(num) ? 100 : num, absolute: true };
    }
    const num = parseInt(trimmed, 10);
    return { value: isNaN(num) ? 0 : num, absolute: false };
}

function expandHex(hex) {
    // Returns { r, g, b, a } as 0-255 values, a is null if not present
    const raw = hex.slice(1);
    let r, g, b, a = null;

    if (raw.length === 3) {
        // #rgb
        r = parseInt(raw[0] + raw[0], 16);
        g = parseInt(raw[1] + raw[1], 16);
        b = parseInt(raw[2] + raw[2], 16);
    } else if (raw.length === 4) {
        // #rgba
        r = parseInt(raw[0] + raw[0], 16);
        g = parseInt(raw[1] + raw[1], 16);
        b = parseInt(raw[2] + raw[2], 16);
        a = parseInt(raw[3] + raw[3], 16);
    } else if (raw.length === 6) {
        // #rrggbb
        r = parseInt(raw.slice(0, 2), 16);
        g = parseInt(raw.slice(2, 4), 16);
        b = parseInt(raw.slice(4, 6), 16);
    } else if (raw.length === 8) {
        // #rrggbbaa
        r = parseInt(raw.slice(0, 2), 16);
        g = parseInt(raw.slice(2, 4), 16);
        b = parseInt(raw.slice(4, 6), 16);
        a = parseInt(raw.slice(6, 8), 16);
    }

    return { r, g, b, a };
}

function adjustHex(hex, dh, ds, dl, da) {
    const { r, g, b, a } = expandHex(hex);
    const hadAlpha = a !== null;

    // Normalize to 0-1
    const rNorm = r / 255;
    const gNorm = g / 255;
    const bNorm = b / 255;

    // RGB to HSL
    const max = Math.max(rNorm, gNorm, bNorm);
    const min = Math.min(rNorm, gNorm, bNorm);
    let h = 0;
    let s = 0;
    let l = (max + min) / 2;

    if (max !== min) {
        const d = max - min;
        s = l > 0.5 ? d / (2 - max - min) : d / (max + min);

        switch (max) {
            case rNorm:
                h = ((gNorm - bNorm) / d + (gNorm < bNorm ? 6 : 0)) / 6;
                break;
            case gNorm:
                h = ((bNorm - rNorm) / d + 2) / 6;
                break;
            case bNorm:
                h = ((rNorm - gNorm) / d + 4) / 6;
                break;
        }
    }

    // Apply HSL shifts
    h = ((h * 360 + dh) % 360 + 360) % 360 / 360;
    s = Math.max(0, Math.min(1, s + ds / 100));
    l = Math.max(0, Math.min(1, l + dl / 100));

    // HSL to RGB
    let rOut, gOut, bOut;

    if (s === 0) {
        rOut = gOut = bOut = l;
    } else {
        const q = l < 0.5 ? l * (1 + s) : l + s - l * s;
        const p = 2 * l - q;

        rOut = hue2rgb(p, q, h + 1 / 3);
        gOut = hue2rgb(p, q, h);
        bOut = hue2rgb(p, q, h - 1 / 3);
    }

    // Handle alpha
    let aOut = null;
    if (hadAlpha || da.value !== 0 || da.absolute) {
        const currentAlpha = hadAlpha ? a : 255;
        if (da.absolute) {
            aOut = Math.round(da.value * 255 / 100);
        } else {
            aOut = Math.round(currentAlpha + (da.value * 255 / 100));
        }
        aOut = Math.max(0, Math.min(255, aOut));
    }

    // Convert to hex
    const toHex = (n) => Math.round(n * 255).toString(16).padStart(2, '0');
    const toHexInt = (n) => n.toString(16).padStart(2, '0');

    if (aOut !== null) {
        return `#${toHex(rOut)}${toHex(gOut)}${toHex(bOut)}${toHexInt(aOut)}`;
    }
    return `#${toHex(rOut)}${toHex(gOut)}${toHex(bOut)}`;
}

function hue2rgb(p, q, t) {
    if (t < 0) t += 1;
    if (t > 1) t -= 1;
    if (t < 1 / 6) return p + (q - p) * 6 * t;
    if (t < 1 / 2) return q;
    if (t < 2 / 3) return p + (q - p) * (2 / 3 - t) * 6;
    return p;
}

function deactivate() {}

module.exports = {
    activate,
    deactivate
};