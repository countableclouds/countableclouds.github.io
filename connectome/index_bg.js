import * as wasm from './index_bg.wasm';

const lTextDecoder = typeof TextDecoder === 'undefined' ? (0, module.require)('util').TextDecoder : TextDecoder;

let cachedTextDecoder = new lTextDecoder('utf-8', { ignoreBOM: true, fatal: true });

cachedTextDecoder.decode();

let cachegetUint8Memory0 = null;
function getUint8Memory0() {
    if (cachegetUint8Memory0 === null || cachegetUint8Memory0.buffer !== wasm.memory.buffer) {
        cachegetUint8Memory0 = new Uint8Array(wasm.memory.buffer);
    }
    return cachegetUint8Memory0;
}

function getStringFromWasm0(ptr, len) {
    return cachedTextDecoder.decode(getUint8Memory0().subarray(ptr, ptr + len));
}

const heap = new Array(32).fill(undefined);

heap.push(undefined, null, true, false);

let heap_next = heap.length;

function addHeapObject(obj) {
    if (heap_next === heap.length) heap.push(heap.length + 1);
    const idx = heap_next;
    heap_next = heap[idx];

    if (typeof(heap_next) !== 'number') throw new Error('corrupt heap');

    heap[idx] = obj;
    return idx;
}

function getObject(idx) { return heap[idx]; }

function dropObject(idx) {
    if (idx < 36) return;
    heap[idx] = heap_next;
    heap_next = idx;
}

function takeObject(idx) {
    const ret = getObject(idx);
    dropObject(idx);
    return ret;
}

function _assertBoolean(n) {
    if (typeof(n) !== 'boolean') {
        throw new Error('expected a boolean argument');
    }
}

function _assertNum(n) {
    if (typeof(n) !== 'number') throw new Error('expected a number argument');
}

function debugString(val) {
    // primitive types
    const type = typeof val;
    if (type == 'number' || type == 'boolean' || val == null) {
        return  `${val}`;
    }
    if (type == 'string') {
        return `"${val}"`;
    }
    if (type == 'symbol') {
        const description = val.description;
        if (description == null) {
            return 'Symbol';
        } else {
            return `Symbol(${description})`;
        }
    }
    if (type == 'function') {
        const name = val.name;
        if (typeof name == 'string' && name.length > 0) {
            return `Function(${name})`;
        } else {
            return 'Function';
        }
    }
    // objects
    if (Array.isArray(val)) {
        const length = val.length;
        let debug = '[';
        if (length > 0) {
            debug += debugString(val[0]);
        }
        for(let i = 1; i < length; i++) {
            debug += ', ' + debugString(val[i]);
        }
        debug += ']';
        return debug;
    }
    // Test for built-in
    const builtInMatches = /\[object ([^\]]+)\]/.exec(toString.call(val));
    let className;
    if (builtInMatches.length > 1) {
        className = builtInMatches[1];
    } else {
        // Failed to match the standard '[object ClassName]'
        return toString.call(val);
    }
    if (className == 'Object') {
        // we're a user defined class or Object
        // JSON.stringify avoids problems with cycles, and is generally much
        // easier than looping through ownProperties of `val`.
        try {
            return 'Object(' + JSON.stringify(val) + ')';
        } catch (_) {
            return 'Object';
        }
    }
    // errors
    if (val instanceof Error) {
        return `${val.name}: ${val.message}\n${val.stack}`;
    }
    // TODO we could test for more things here, like `Set`s and `Map`s.
    return className;
}

let WASM_VECTOR_LEN = 0;

const lTextEncoder = typeof TextEncoder === 'undefined' ? (0, module.require)('util').TextEncoder : TextEncoder;

let cachedTextEncoder = new lTextEncoder('utf-8');

const encodeString = (typeof cachedTextEncoder.encodeInto === 'function'
    ? function (arg, view) {
    return cachedTextEncoder.encodeInto(arg, view);
}
    : function (arg, view) {
    const buf = cachedTextEncoder.encode(arg);
    view.set(buf);
    return {
        read: arg.length,
        written: buf.length
    };
});

function passStringToWasm0(arg, malloc, realloc) {

    if (typeof(arg) !== 'string') throw new Error('expected a string argument');

    if (realloc === undefined) {
        const buf = cachedTextEncoder.encode(arg);
        const ptr = malloc(buf.length);
        getUint8Memory0().subarray(ptr, ptr + buf.length).set(buf);
        WASM_VECTOR_LEN = buf.length;
        return ptr;
    }

    let len = arg.length;
    let ptr = malloc(len);

    const mem = getUint8Memory0();

    let offset = 0;

    for (; offset < len; offset++) {
        const code = arg.charCodeAt(offset);
        if (code > 0x7F) break;
        mem[ptr + offset] = code;
    }

    if (offset !== len) {
        if (offset !== 0) {
            arg = arg.slice(offset);
        }
        ptr = realloc(ptr, len, len = offset + arg.length * 3);
        const view = getUint8Memory0().subarray(ptr + offset, ptr + len);
        const ret = encodeString(arg, view);
        if (ret.read !== arg.length) throw new Error('failed to pass whole string');
        offset += ret.written;
    }

    WASM_VECTOR_LEN = offset;
    return ptr;
}

let cachegetInt32Memory0 = null;
function getInt32Memory0() {
    if (cachegetInt32Memory0 === null || cachegetInt32Memory0.buffer !== wasm.memory.buffer) {
        cachegetInt32Memory0 = new Int32Array(wasm.memory.buffer);
    }
    return cachegetInt32Memory0;
}

function makeMutClosure(arg0, arg1, dtor, f) {
    const state = { a: arg0, b: arg1, cnt: 1, dtor };
    const real = (...args) => {
        // First up with a closure we increment the internal reference
        // count. This ensures that the Rust closure environment won't
        // be deallocated while we're invoking it.
        state.cnt++;
        const a = state.a;
        state.a = 0;
        try {
            return f(a, state.b, ...args);
        } finally {
            if (--state.cnt === 0) {
                wasm.__wbindgen_export_2.get(state.dtor)(a, state.b);

            } else {
                state.a = a;
            }
        }
    };
    real.original = state;

    return real;
}

function logError(f, args) {
    try {
        return f.apply(this, args);
    } catch (e) {
        let error = (function () {
            try {
                return e instanceof Error ? `${e.message}\n\nStack:\n${e.stack}` : e.toString();
            } catch(_) {
                return "<failed to stringify thrown value>";
            }
        }());
        console.error("wasm-bindgen: imported JS function that was not marked as `catch` threw an error:", error);
        throw e;
    }
}
function __wbg_adapter_24(arg0, arg1) {
    _assertNum(arg0);
    _assertNum(arg1);
    wasm._dyn_core__ops__function__FnMut_____Output___R_as_wasm_bindgen__closure__WasmClosure___describe__invoke__h4fe958a534f62375(arg0, arg1);
}

function __wbg_adapter_27(arg0, arg1, arg2) {
    _assertNum(arg0);
    _assertNum(arg1);
    wasm._dyn_core__ops__function__FnMut__A____Output___R_as_wasm_bindgen__closure__WasmClosure___describe__invoke__h7f3d2994cd9299ac(arg0, arg1, addHeapObject(arg2));
}

function __wbg_adapter_30(arg0, arg1, arg2) {
    _assertNum(arg0);
    _assertNum(arg1);
    wasm._dyn_core__ops__function__FnMut__A____Output___R_as_wasm_bindgen__closure__WasmClosure___describe__invoke__h9320b46e4bdc8afc(arg0, arg1, addHeapObject(arg2));
}

function __wbg_adapter_33(arg0, arg1, arg2) {
    _assertNum(arg0);
    _assertNum(arg1);
    wasm._dyn_core__ops__function__FnMut__A____Output___R_as_wasm_bindgen__closure__WasmClosure___describe__invoke__h3f3bd76755de04a2(arg0, arg1, addHeapObject(arg2));
}

function __wbg_adapter_36(arg0, arg1, arg2) {
    _assertNum(arg0);
    _assertNum(arg1);
    wasm._dyn_core__ops__function__FnMut__A____Output___R_as_wasm_bindgen__closure__WasmClosure___describe__invoke__hbe0fdf2d3ad84a68(arg0, arg1, addHeapObject(arg2));
}

function __wbg_adapter_39(arg0, arg1, arg2) {
    _assertNum(arg0);
    _assertNum(arg1);
    wasm._dyn_core__ops__function__FnMut__A____Output___R_as_wasm_bindgen__closure__WasmClosure___describe__invoke__h44bac4122a541c0b(arg0, arg1, addHeapObject(arg2));
}

/**
*/
export function init_panic_hook() {
    wasm.init_panic_hook();
}

/**
*/
export function main() {
    wasm.main();
}

function handleError(f, args) {
    try {
        return f.apply(this, args);
    } catch (e) {
        wasm.__wbindgen_exn_store(addHeapObject(e));
    }
}

function getArrayU8FromWasm0(ptr, len) {
    return getUint8Memory0().subarray(ptr / 1, ptr / 1 + len);
}

let cachegetFloat32Memory0 = null;
function getFloat32Memory0() {
    if (cachegetFloat32Memory0 === null || cachegetFloat32Memory0.buffer !== wasm.memory.buffer) {
        cachegetFloat32Memory0 = new Float32Array(wasm.memory.buffer);
    }
    return cachegetFloat32Memory0;
}

function getArrayF32FromWasm0(ptr, len) {
    return getFloat32Memory0().subarray(ptr / 4, ptr / 4 + len);
}

function isLikeNone(x) {
    return x === undefined || x === null;
}

export function __wbindgen_string_new(arg0, arg1) {
    var ret = getStringFromWasm0(arg0, arg1);
    return addHeapObject(ret);
};

export function __wbindgen_cb_drop(arg0) {
    const obj = takeObject(arg0).original;
    if (obj.cnt-- == 1) {
        obj.a = 0;
        return true;
    }
    var ret = false;
    _assertBoolean(ret);
    return ret;
};

export function __wbg_error_09919627ac0992f5() { return logError(function (arg0, arg1) {
    try {
        console.error(getStringFromWasm0(arg0, arg1));
    } finally {
        wasm.__wbindgen_free(arg0, arg1);
    }
}, arguments) };

export function __wbg_new_693216e109162396() { return logError(function () {
    var ret = new Error();
    return addHeapObject(ret);
}, arguments) };

export function __wbg_stack_0ddaca5d1abfb52f() { return logError(function (arg0, arg1) {
    var ret = getObject(arg1).stack;
    var ptr0 = passStringToWasm0(ret, wasm.__wbindgen_malloc, wasm.__wbindgen_realloc);
    var len0 = WASM_VECTOR_LEN;
    getInt32Memory0()[arg0 / 4 + 1] = len0;
    getInt32Memory0()[arg0 / 4 + 0] = ptr0;
}, arguments) };

export function __wbindgen_object_drop_ref(arg0) {
    takeObject(arg0);
};

export function __wbindgen_object_clone_ref(arg0) {
    var ret = getObject(arg0);
    return addHeapObject(ret);
};

export function __wbindgen_jsval_eq(arg0, arg1) {
    var ret = getObject(arg0) === getObject(arg1);
    _assertBoolean(ret);
    return ret;
};

export function __wbindgen_boolean_get(arg0) {
    const v = getObject(arg0);
    var ret = typeof(v) === 'boolean' ? (v ? 1 : 0) : 2;
    _assertNum(ret);
    return ret;
};

export function __wbg_bufferData_bba22fbe5dd1f1d6() { return logError(function (arg0, arg1, arg2, arg3) {
    getObject(arg0).bufferData(arg1 >>> 0, getObject(arg2), arg3 >>> 0);
}, arguments) };

export function __wbg_bufferSubData_27cef7a644910dfc() { return logError(function (arg0, arg1, arg2, arg3) {
    getObject(arg0).bufferSubData(arg1 >>> 0, arg2, getObject(arg3));
}, arguments) };

export function __wbg_texImage2D_213d07115e0d16c7() { return handleError(function (arg0, arg1, arg2, arg3, arg4, arg5, arg6, arg7, arg8, arg9) {
    getObject(arg0).texImage2D(arg1 >>> 0, arg2, arg3, arg4, arg5, arg6, arg7 >>> 0, arg8 >>> 0, getObject(arg9));
}, arguments) };

export function __wbg_texSubImage2D_12b6a3b3a1c3a05b() { return handleError(function (arg0, arg1, arg2, arg3, arg4, arg5, arg6, arg7, arg8, arg9, arg10) {
    getObject(arg0).texSubImage2D(arg1 >>> 0, arg2, arg3, arg4, arg5, arg6, arg7 >>> 0, arg8 >>> 0, arg9 === 0 ? undefined : getArrayU8FromWasm0(arg9, arg10));
}, arguments) };

export function __wbg_texSubImage2D_eee3ea60432466ce() { return handleError(function (arg0, arg1, arg2, arg3, arg4, arg5, arg6, arg7, arg8, arg9) {
    getObject(arg0).texSubImage2D(arg1 >>> 0, arg2, arg3, arg4, arg5, arg6, arg7 >>> 0, arg8 >>> 0, arg9);
}, arguments) };

export function __wbg_uniformMatrix3fv_ac980fa6b58112de() { return logError(function (arg0, arg1, arg2, arg3, arg4) {
    getObject(arg0).uniformMatrix3fv(getObject(arg1), arg2 !== 0, getArrayF32FromWasm0(arg3, arg4));
}, arguments) };

export function __wbg_uniformMatrix4fv_03d4a6800fd3537e() { return logError(function (arg0, arg1, arg2, arg3, arg4) {
    getObject(arg0).uniformMatrix4fv(getObject(arg1), arg2 !== 0, getArrayF32FromWasm0(arg3, arg4));
}, arguments) };

export function __wbg_activeTexture_0092956fa2eefd8c() { return logError(function (arg0, arg1) {
    getObject(arg0).activeTexture(arg1 >>> 0);
}, arguments) };

export function __wbg_attachShader_7faccaa7b5ac28a6() { return logError(function (arg0, arg1, arg2) {
    getObject(arg0).attachShader(getObject(arg1), getObject(arg2));
}, arguments) };

export function __wbg_bindBuffer_4ece833dd10cac2f() { return logError(function (arg0, arg1, arg2) {
    getObject(arg0).bindBuffer(arg1 >>> 0, getObject(arg2));
}, arguments) };

export function __wbg_bindFramebuffer_48c4bf8ff82bf7e9() { return logError(function (arg0, arg1, arg2) {
    getObject(arg0).bindFramebuffer(arg1 >>> 0, getObject(arg2));
}, arguments) };

export function __wbg_bindRenderbuffer_4a9ad1cf80580397() { return logError(function (arg0, arg1, arg2) {
    getObject(arg0).bindRenderbuffer(arg1 >>> 0, getObject(arg2));
}, arguments) };

export function __wbg_bindTexture_9d8ed0fcd83eb0a9() { return logError(function (arg0, arg1, arg2) {
    getObject(arg0).bindTexture(arg1 >>> 0, getObject(arg2));
}, arguments) };

export function __wbg_blendFuncSeparate_1d03d2ee0347dd73() { return logError(function (arg0, arg1, arg2, arg3, arg4) {
    getObject(arg0).blendFuncSeparate(arg1 >>> 0, arg2 >>> 0, arg3 >>> 0, arg4 >>> 0);
}, arguments) };

export function __wbg_clear_4ce66c813d66e77d() { return logError(function (arg0, arg1) {
    getObject(arg0).clear(arg1 >>> 0);
}, arguments) };

export function __wbg_clearColor_71f96fd72a7646a6() { return logError(function (arg0, arg1, arg2, arg3, arg4) {
    getObject(arg0).clearColor(arg1, arg2, arg3, arg4);
}, arguments) };

export function __wbg_compileShader_dd66d66a5a6481f3() { return logError(function (arg0, arg1) {
    getObject(arg0).compileShader(getObject(arg1));
}, arguments) };

export function __wbg_createBuffer_5c5caa16032a81b7() { return logError(function (arg0) {
    var ret = getObject(arg0).createBuffer();
    return isLikeNone(ret) ? 0 : addHeapObject(ret);
}, arguments) };

export function __wbg_createFramebuffer_9818fc04b4a38c18() { return logError(function (arg0) {
    var ret = getObject(arg0).createFramebuffer();
    return isLikeNone(ret) ? 0 : addHeapObject(ret);
}, arguments) };

export function __wbg_createProgram_32d01a55e144b9fc() { return logError(function (arg0) {
    var ret = getObject(arg0).createProgram();
    return isLikeNone(ret) ? 0 : addHeapObject(ret);
}, arguments) };

export function __wbg_createRenderbuffer_d1a55ec78e26295b() { return logError(function (arg0) {
    var ret = getObject(arg0).createRenderbuffer();
    return isLikeNone(ret) ? 0 : addHeapObject(ret);
}, arguments) };

export function __wbg_createShader_6e8eed55567fe1a6() { return logError(function (arg0, arg1) {
    var ret = getObject(arg0).createShader(arg1 >>> 0);
    return isLikeNone(ret) ? 0 : addHeapObject(ret);
}, arguments) };

export function __wbg_createTexture_8f31e7386e22fc37() { return logError(function (arg0) {
    var ret = getObject(arg0).createTexture();
    return isLikeNone(ret) ? 0 : addHeapObject(ret);
}, arguments) };

export function __wbg_cullFace_811ddac8b7ea5416() { return logError(function (arg0, arg1) {
    getObject(arg0).cullFace(arg1 >>> 0);
}, arguments) };

export function __wbg_deleteBuffer_de80b51d8166fddb() { return logError(function (arg0, arg1) {
    getObject(arg0).deleteBuffer(getObject(arg1));
}, arguments) };

export function __wbg_deleteFramebuffer_5f58ccb548438c57() { return logError(function (arg0, arg1) {
    getObject(arg0).deleteFramebuffer(getObject(arg1));
}, arguments) };

export function __wbg_deleteProgram_3ec3c43f2cddde7f() { return logError(function (arg0, arg1) {
    getObject(arg0).deleteProgram(getObject(arg1));
}, arguments) };

export function __wbg_deleteRenderbuffer_6372146d4689793e() { return logError(function (arg0, arg1) {
    getObject(arg0).deleteRenderbuffer(getObject(arg1));
}, arguments) };

export function __wbg_deleteShader_b4e32582cfe4e771() { return logError(function (arg0, arg1) {
    getObject(arg0).deleteShader(getObject(arg1));
}, arguments) };

export function __wbg_deleteTexture_a0632c71429795ac() { return logError(function (arg0, arg1) {
    getObject(arg0).deleteTexture(getObject(arg1));
}, arguments) };

export function __wbg_depthFunc_63af2cb1edcba36d() { return logError(function (arg0, arg1) {
    getObject(arg0).depthFunc(arg1 >>> 0);
}, arguments) };

export function __wbg_disable_b05e075ae54fa448() { return logError(function (arg0, arg1) {
    getObject(arg0).disable(arg1 >>> 0);
}, arguments) };

export function __wbg_disableVertexAttribArray_748bc5b21abcb0f4() { return logError(function (arg0, arg1) {
    getObject(arg0).disableVertexAttribArray(arg1 >>> 0);
}, arguments) };

export function __wbg_drawArrays_5db2f4e6291f7fb2() { return logError(function (arg0, arg1, arg2, arg3) {
    getObject(arg0).drawArrays(arg1 >>> 0, arg2, arg3);
}, arguments) };

export function __wbg_drawElements_a41bb53d39cd6297() { return logError(function (arg0, arg1, arg2, arg3, arg4) {
    getObject(arg0).drawElements(arg1 >>> 0, arg2, arg3 >>> 0, arg4);
}, arguments) };

export function __wbg_enable_766e546395da5a5d() { return logError(function (arg0, arg1) {
    getObject(arg0).enable(arg1 >>> 0);
}, arguments) };

export function __wbg_enableVertexAttribArray_91da8d3cbe0c2bbd() { return logError(function (arg0, arg1) {
    getObject(arg0).enableVertexAttribArray(arg1 >>> 0);
}, arguments) };

export function __wbg_framebufferRenderbuffer_9d619e8bf8f2aeb6() { return logError(function (arg0, arg1, arg2, arg3, arg4) {
    getObject(arg0).framebufferRenderbuffer(arg1 >>> 0, arg2 >>> 0, arg3 >>> 0, getObject(arg4));
}, arguments) };

export function __wbg_framebufferTexture2D_3da41a7f38e2c523() { return logError(function (arg0, arg1, arg2, arg3, arg4, arg5) {
    getObject(arg0).framebufferTexture2D(arg1 >>> 0, arg2 >>> 0, arg3 >>> 0, getObject(arg4), arg5);
}, arguments) };

export function __wbg_frontFace_0b592d7c70e6473b() { return logError(function (arg0, arg1) {
    getObject(arg0).frontFace(arg1 >>> 0);
}, arguments) };

export function __wbg_getAttribLocation_5d304d390c7273f5() { return logError(function (arg0, arg1, arg2, arg3) {
    var ret = getObject(arg0).getAttribLocation(getObject(arg1), getStringFromWasm0(arg2, arg3));
    _assertNum(ret);
    return ret;
}, arguments) };

export function __wbg_getError_868f7c8ef6475b32() { return logError(function (arg0) {
    var ret = getObject(arg0).getError();
    _assertNum(ret);
    return ret;
}, arguments) };

export function __wbg_getShaderInfoLog_ba1de20c14b6fb63() { return logError(function (arg0, arg1, arg2) {
    var ret = getObject(arg1).getShaderInfoLog(getObject(arg2));
    var ptr0 = isLikeNone(ret) ? 0 : passStringToWasm0(ret, wasm.__wbindgen_malloc, wasm.__wbindgen_realloc);
    var len0 = WASM_VECTOR_LEN;
    getInt32Memory0()[arg0 / 4 + 1] = len0;
    getInt32Memory0()[arg0 / 4 + 0] = ptr0;
}, arguments) };

export function __wbg_getShaderParameter_264d9ab5c13ece4d() { return logError(function (arg0, arg1, arg2) {
    var ret = getObject(arg0).getShaderParameter(getObject(arg1), arg2 >>> 0);
    return addHeapObject(ret);
}, arguments) };

export function __wbg_getUniformLocation_77b2d89291f84289() { return logError(function (arg0, arg1, arg2, arg3) {
    var ret = getObject(arg0).getUniformLocation(getObject(arg1), getStringFromWasm0(arg2, arg3));
    return isLikeNone(ret) ? 0 : addHeapObject(ret);
}, arguments) };

export function __wbg_isBuffer_59ff5c3ff161e3cc() { return logError(function (arg0, arg1) {
    var ret = getObject(arg0).isBuffer(getObject(arg1));
    _assertBoolean(ret);
    return ret;
}, arguments) };

export function __wbg_isProgram_20e1ef2f530ee80c() { return logError(function (arg0, arg1) {
    var ret = getObject(arg0).isProgram(getObject(arg1));
    _assertBoolean(ret);
    return ret;
}, arguments) };

export function __wbg_isShader_6beb49da23f2c95e() { return logError(function (arg0, arg1) {
    var ret = getObject(arg0).isShader(getObject(arg1));
    _assertBoolean(ret);
    return ret;
}, arguments) };

export function __wbg_isTexture_1fe56626414b944d() { return logError(function (arg0, arg1) {
    var ret = getObject(arg0).isTexture(getObject(arg1));
    _assertBoolean(ret);
    return ret;
}, arguments) };

export function __wbg_lineWidth_082bba584c9a5078() { return logError(function (arg0, arg1) {
    getObject(arg0).lineWidth(arg1);
}, arguments) };

export function __wbg_linkProgram_b84796e37364e5c9() { return logError(function (arg0, arg1) {
    getObject(arg0).linkProgram(getObject(arg1));
}, arguments) };

export function __wbg_pixelStorei_a9b9b42ef01616b2() { return logError(function (arg0, arg1, arg2) {
    getObject(arg0).pixelStorei(arg1 >>> 0, arg2);
}, arguments) };

export function __wbg_renderbufferStorage_6a62bdbe7df6b7ed() { return logError(function (arg0, arg1, arg2, arg3, arg4) {
    getObject(arg0).renderbufferStorage(arg1 >>> 0, arg2 >>> 0, arg3, arg4);
}, arguments) };

export function __wbg_scissor_5802aaee71f2eb0e() { return logError(function (arg0, arg1, arg2, arg3, arg4) {
    getObject(arg0).scissor(arg1, arg2, arg3, arg4);
}, arguments) };

export function __wbg_shaderSource_18f45f93c05a8311() { return logError(function (arg0, arg1, arg2, arg3) {
    getObject(arg0).shaderSource(getObject(arg1), getStringFromWasm0(arg2, arg3));
}, arguments) };

export function __wbg_texParameteri_c54aab65b2f8cf6d() { return logError(function (arg0, arg1, arg2, arg3) {
    getObject(arg0).texParameteri(arg1 >>> 0, arg2 >>> 0, arg3);
}, arguments) };

export function __wbg_uniform1i_e287345af4468e22() { return logError(function (arg0, arg1, arg2) {
    getObject(arg0).uniform1i(getObject(arg1), arg2);
}, arguments) };

export function __wbg_uniform2f_f8d8e7662e0e0eb6() { return logError(function (arg0, arg1, arg2, arg3) {
    getObject(arg0).uniform2f(getObject(arg1), arg2, arg3);
}, arguments) };

export function __wbg_uniform3f_cdb59ee68d0600a5() { return logError(function (arg0, arg1, arg2, arg3, arg4) {
    getObject(arg0).uniform3f(getObject(arg1), arg2, arg3, arg4);
}, arguments) };

export function __wbg_uniform4f_e82c1eabdf1458fe() { return logError(function (arg0, arg1, arg2, arg3, arg4, arg5) {
    getObject(arg0).uniform4f(getObject(arg1), arg2, arg3, arg4, arg5);
}, arguments) };

export function __wbg_useProgram_c2fdf4a953d1128a() { return logError(function (arg0, arg1) {
    getObject(arg0).useProgram(getObject(arg1));
}, arguments) };

export function __wbg_vertexAttribPointer_76d558694fe81cd7() { return logError(function (arg0, arg1, arg2, arg3, arg4, arg5, arg6) {
    getObject(arg0).vertexAttribPointer(arg1 >>> 0, arg2, arg3 >>> 0, arg4 !== 0, arg5, arg6);
}, arguments) };

export function __wbg_viewport_da0901eee69b9909() { return logError(function (arg0, arg1, arg2, arg3, arg4) {
    getObject(arg0).viewport(arg1, arg2, arg3, arg4);
}, arguments) };

export function __wbg_instanceof_Window_c4b70662a0d2c5ec() { return logError(function (arg0) {
    var ret = getObject(arg0) instanceof Window;
    _assertBoolean(ret);
    return ret;
}, arguments) };

export function __wbg_document_1c64944725c0d81d() { return logError(function (arg0) {
    var ret = getObject(arg0).document;
    return isLikeNone(ret) ? 0 : addHeapObject(ret);
}, arguments) };

export function __wbg_devicePixelRatio_d8c3852bb37f76bf() { return logError(function (arg0) {
    var ret = getObject(arg0).devicePixelRatio;
    return ret;
}, arguments) };

export function __wbg_requestAnimationFrame_71638ca922068239() { return handleError(function (arg0, arg1) {
    var ret = getObject(arg0).requestAnimationFrame(getObject(arg1));
    _assertNum(ret);
    return ret;
}, arguments) };

export function __wbg_target_cc69dde6c2d9ec90() { return logError(function (arg0) {
    var ret = getObject(arg0).target;
    return isLikeNone(ret) ? 0 : addHeapObject(ret);
}, arguments) };

export function __wbg_x_fbafdccc547c9d4b() { return logError(function (arg0) {
    var ret = getObject(arg0).x;
    return ret;
}, arguments) };

export function __wbg_y_6f4ed3bbef2ef02d() { return logError(function (arg0) {
    var ret = getObject(arg0).y;
    return ret;
}, arguments) };

export function __wbg_clientX_97ff0f5c7b19e687() { return logError(function (arg0) {
    var ret = getObject(arg0).clientX;
    _assertNum(ret);
    return ret;
}, arguments) };

export function __wbg_clientY_cacd4a7e44b9719b() { return logError(function (arg0) {
    var ret = getObject(arg0).clientY;
    _assertNum(ret);
    return ret;
}, arguments) };

export function __wbg_ctrlKey_9761d22fa42f09c0() { return logError(function (arg0) {
    var ret = getObject(arg0).ctrlKey;
    _assertBoolean(ret);
    return ret;
}, arguments) };

export function __wbg_shiftKey_78ee0fc1aa572c2e() { return logError(function (arg0) {
    var ret = getObject(arg0).shiftKey;
    _assertBoolean(ret);
    return ret;
}, arguments) };

export function __wbg_altKey_8936038d973c56db() { return logError(function (arg0) {
    var ret = getObject(arg0).altKey;
    _assertBoolean(ret);
    return ret;
}, arguments) };

export function __wbg_metaKey_e6b9e0aa35aa2974() { return logError(function (arg0) {
    var ret = getObject(arg0).metaKey;
    _assertBoolean(ret);
    return ret;
}, arguments) };

export function __wbg_button_a02c0467d38e8338() { return logError(function (arg0) {
    var ret = getObject(arg0).button;
    _assertNum(ret);
    return ret;
}, arguments) };

export function __wbg_buttons_9d7b6c334f0b37de() { return logError(function (arg0) {
    var ret = getObject(arg0).buttons;
    _assertNum(ret);
    return ret;
}, arguments) };

export function __wbg_deltaX_8cfc6cd15e97d97c() { return logError(function (arg0) {
    var ret = getObject(arg0).deltaX;
    return ret;
}, arguments) };

export function __wbg_deltaY_080604c20160c0e8() { return logError(function (arg0) {
    var ret = getObject(arg0).deltaY;
    return ret;
}, arguments) };

export function __wbg_deltaMode_c5ec1ee518ea0a08() { return logError(function (arg0) {
    var ret = getObject(arg0).deltaMode;
    _assertNum(ret);
    return ret;
}, arguments) };

export function __wbg_length_1d27563e3515722e() { return logError(function (arg0) {
    var ret = getObject(arg0).length;
    _assertNum(ret);
    return ret;
}, arguments) };

export function __wbg_get_20b719b18767c76e() { return logError(function (arg0, arg1) {
    var ret = getObject(arg0)[arg1 >>> 0];
    return isLikeNone(ret) ? 0 : addHeapObject(ret);
}, arguments) };

export function __wbg_getBoundingClientRect_2fba0402ea2a6ec4() { return logError(function (arg0) {
    var ret = getObject(arg0).getBoundingClientRect();
    return addHeapObject(ret);
}, arguments) };

export function __wbg_getElementById_f3e94458ce77f0d0() { return logError(function (arg0, arg1, arg2) {
    var ret = getObject(arg0).getElementById(getStringFromWasm0(arg1, arg2));
    return isLikeNone(ret) ? 0 : addHeapObject(ret);
}, arguments) };

export function __wbg_instanceof_WebGlRenderingContext_101b938bec1286a3() { return logError(function (arg0) {
    var ret = getObject(arg0) instanceof WebGLRenderingContext;
    _assertBoolean(ret);
    return ret;
}, arguments) };

export function __wbg_bufferData_6beb22ecb30c1316() { return logError(function (arg0, arg1, arg2, arg3) {
    getObject(arg0).bufferData(arg1 >>> 0, getObject(arg2), arg3 >>> 0);
}, arguments) };

export function __wbg_bufferSubData_179b18fb1177c92c() { return logError(function (arg0, arg1, arg2, arg3) {
    getObject(arg0).bufferSubData(arg1 >>> 0, arg2, getObject(arg3));
}, arguments) };

export function __wbg_texImage2D_16915663678a4882() { return handleError(function (arg0, arg1, arg2, arg3, arg4, arg5, arg6, arg7, arg8, arg9) {
    getObject(arg0).texImage2D(arg1 >>> 0, arg2, arg3, arg4, arg5, arg6, arg7 >>> 0, arg8 >>> 0, getObject(arg9));
}, arguments) };

export function __wbg_texSubImage2D_b98003d468b56808() { return handleError(function (arg0, arg1, arg2, arg3, arg4, arg5, arg6, arg7, arg8, arg9, arg10) {
    getObject(arg0).texSubImage2D(arg1 >>> 0, arg2, arg3, arg4, arg5, arg6, arg7 >>> 0, arg8 >>> 0, arg9 === 0 ? undefined : getArrayU8FromWasm0(arg9, arg10));
}, arguments) };

export function __wbg_uniformMatrix3fv_340429fe0911bc6f() { return logError(function (arg0, arg1, arg2, arg3, arg4) {
    getObject(arg0).uniformMatrix3fv(getObject(arg1), arg2 !== 0, getArrayF32FromWasm0(arg3, arg4));
}, arguments) };

export function __wbg_uniformMatrix4fv_a92133b68236ac68() { return logError(function (arg0, arg1, arg2, arg3, arg4) {
    getObject(arg0).uniformMatrix4fv(getObject(arg1), arg2 !== 0, getArrayF32FromWasm0(arg3, arg4));
}, arguments) };

export function __wbg_activeTexture_b34aca0c2110966c() { return logError(function (arg0, arg1) {
    getObject(arg0).activeTexture(arg1 >>> 0);
}, arguments) };

export function __wbg_attachShader_eaa824fd5b37a770() { return logError(function (arg0, arg1, arg2) {
    getObject(arg0).attachShader(getObject(arg1), getObject(arg2));
}, arguments) };

export function __wbg_bindBuffer_2ca7e1c18819ecb2() { return logError(function (arg0, arg1, arg2) {
    getObject(arg0).bindBuffer(arg1 >>> 0, getObject(arg2));
}, arguments) };

export function __wbg_bindFramebuffer_c9f468afa9d42a5f() { return logError(function (arg0, arg1, arg2) {
    getObject(arg0).bindFramebuffer(arg1 >>> 0, getObject(arg2));
}, arguments) };

export function __wbg_bindRenderbuffer_7b2b49f71f3eeef9() { return logError(function (arg0, arg1, arg2) {
    getObject(arg0).bindRenderbuffer(arg1 >>> 0, getObject(arg2));
}, arguments) };

export function __wbg_bindTexture_edd827f3dba6038e() { return logError(function (arg0, arg1, arg2) {
    getObject(arg0).bindTexture(arg1 >>> 0, getObject(arg2));
}, arguments) };

export function __wbg_blendFuncSeparate_815126bb13307b97() { return logError(function (arg0, arg1, arg2, arg3, arg4) {
    getObject(arg0).blendFuncSeparate(arg1 >>> 0, arg2 >>> 0, arg3 >>> 0, arg4 >>> 0);
}, arguments) };

export function __wbg_clear_da26620d46f0a11a() { return logError(function (arg0, arg1) {
    getObject(arg0).clear(arg1 >>> 0);
}, arguments) };

export function __wbg_clearColor_cbf22f8faa5a52c1() { return logError(function (arg0, arg1, arg2, arg3, arg4) {
    getObject(arg0).clearColor(arg1, arg2, arg3, arg4);
}, arguments) };

export function __wbg_compileShader_8fb70a472f32552c() { return logError(function (arg0, arg1) {
    getObject(arg0).compileShader(getObject(arg1));
}, arguments) };

export function __wbg_createBuffer_4802e2f0e1b1acdf() { return logError(function (arg0) {
    var ret = getObject(arg0).createBuffer();
    return isLikeNone(ret) ? 0 : addHeapObject(ret);
}, arguments) };

export function __wbg_createFramebuffer_0157699cdc720b46() { return logError(function (arg0) {
    var ret = getObject(arg0).createFramebuffer();
    return isLikeNone(ret) ? 0 : addHeapObject(ret);
}, arguments) };

export function __wbg_createProgram_b1d94f4c7554d3a1() { return logError(function (arg0) {
    var ret = getObject(arg0).createProgram();
    return isLikeNone(ret) ? 0 : addHeapObject(ret);
}, arguments) };

export function __wbg_createRenderbuffer_f10d2abe2f2c5aa4() { return logError(function (arg0) {
    var ret = getObject(arg0).createRenderbuffer();
    return isLikeNone(ret) ? 0 : addHeapObject(ret);
}, arguments) };

export function __wbg_createShader_da09e167692f0dc7() { return logError(function (arg0, arg1) {
    var ret = getObject(arg0).createShader(arg1 >>> 0);
    return isLikeNone(ret) ? 0 : addHeapObject(ret);
}, arguments) };

export function __wbg_createTexture_bafc7c08393ae59d() { return logError(function (arg0) {
    var ret = getObject(arg0).createTexture();
    return isLikeNone(ret) ? 0 : addHeapObject(ret);
}, arguments) };

export function __wbg_cullFace_567e744e6243934e() { return logError(function (arg0, arg1) {
    getObject(arg0).cullFace(arg1 >>> 0);
}, arguments) };

export function __wbg_deleteBuffer_9c31f3452ba32db1() { return logError(function (arg0, arg1) {
    getObject(arg0).deleteBuffer(getObject(arg1));
}, arguments) };

export function __wbg_deleteFramebuffer_0f43513bd6c6d986() { return logError(function (arg0, arg1) {
    getObject(arg0).deleteFramebuffer(getObject(arg1));
}, arguments) };

export function __wbg_deleteProgram_a2c849932f79e7af() { return logError(function (arg0, arg1) {
    getObject(arg0).deleteProgram(getObject(arg1));
}, arguments) };

export function __wbg_deleteRenderbuffer_c623daba22fb2331() { return logError(function (arg0, arg1) {
    getObject(arg0).deleteRenderbuffer(getObject(arg1));
}, arguments) };

export function __wbg_deleteShader_a97b67b619baa0f0() { return logError(function (arg0, arg1) {
    getObject(arg0).deleteShader(getObject(arg1));
}, arguments) };

export function __wbg_deleteTexture_82d755a5ac828346() { return logError(function (arg0, arg1) {
    getObject(arg0).deleteTexture(getObject(arg1));
}, arguments) };

export function __wbg_depthFunc_2ffde5a067fe29a4() { return logError(function (arg0, arg1) {
    getObject(arg0).depthFunc(arg1 >>> 0);
}, arguments) };

export function __wbg_disable_b07faddb7d04349f() { return logError(function (arg0, arg1) {
    getObject(arg0).disable(arg1 >>> 0);
}, arguments) };

export function __wbg_disableVertexAttribArray_c9fdabd5f12b0539() { return logError(function (arg0, arg1) {
    getObject(arg0).disableVertexAttribArray(arg1 >>> 0);
}, arguments) };

export function __wbg_drawArrays_deb0ae940b2e372b() { return logError(function (arg0, arg1, arg2, arg3) {
    getObject(arg0).drawArrays(arg1 >>> 0, arg2, arg3);
}, arguments) };

export function __wbg_drawElements_8e8af4b6757fedce() { return logError(function (arg0, arg1, arg2, arg3, arg4) {
    getObject(arg0).drawElements(arg1 >>> 0, arg2, arg3 >>> 0, arg4);
}, arguments) };

export function __wbg_enable_d3d210aeb08eff52() { return logError(function (arg0, arg1) {
    getObject(arg0).enable(arg1 >>> 0);
}, arguments) };

export function __wbg_enableVertexAttribArray_d539e547495bea44() { return logError(function (arg0, arg1) {
    getObject(arg0).enableVertexAttribArray(arg1 >>> 0);
}, arguments) };

export function __wbg_framebufferTexture2D_923c6fc6645661bc() { return logError(function (arg0, arg1, arg2, arg3, arg4, arg5) {
    getObject(arg0).framebufferTexture2D(arg1 >>> 0, arg2 >>> 0, arg3 >>> 0, getObject(arg4), arg5);
}, arguments) };

export function __wbg_frontFace_1ae0f9f988bd176a() { return logError(function (arg0, arg1) {
    getObject(arg0).frontFace(arg1 >>> 0);
}, arguments) };

export function __wbg_getAttribLocation_706a0beabcdaebcf() { return logError(function (arg0, arg1, arg2, arg3) {
    var ret = getObject(arg0).getAttribLocation(getObject(arg1), getStringFromWasm0(arg2, arg3));
    _assertNum(ret);
    return ret;
}, arguments) };

export function __wbg_getError_b3af1b36cdeb6533() { return logError(function (arg0) {
    var ret = getObject(arg0).getError();
    _assertNum(ret);
    return ret;
}, arguments) };

export function __wbg_getExtension_045789240c50a108() { return handleError(function (arg0, arg1, arg2) {
    var ret = getObject(arg0).getExtension(getStringFromWasm0(arg1, arg2));
    return isLikeNone(ret) ? 0 : addHeapObject(ret);
}, arguments) };

export function __wbg_getShaderInfoLog_ba51160c01b98360() { return logError(function (arg0, arg1, arg2) {
    var ret = getObject(arg1).getShaderInfoLog(getObject(arg2));
    var ptr0 = isLikeNone(ret) ? 0 : passStringToWasm0(ret, wasm.__wbindgen_malloc, wasm.__wbindgen_realloc);
    var len0 = WASM_VECTOR_LEN;
    getInt32Memory0()[arg0 / 4 + 1] = len0;
    getInt32Memory0()[arg0 / 4 + 0] = ptr0;
}, arguments) };

export function __wbg_getShaderParameter_dadc55c10928575d() { return logError(function (arg0, arg1, arg2) {
    var ret = getObject(arg0).getShaderParameter(getObject(arg1), arg2 >>> 0);
    return addHeapObject(ret);
}, arguments) };

export function __wbg_getUniformLocation_c3b3570b4632cc5c() { return logError(function (arg0, arg1, arg2, arg3) {
    var ret = getObject(arg0).getUniformLocation(getObject(arg1), getStringFromWasm0(arg2, arg3));
    return isLikeNone(ret) ? 0 : addHeapObject(ret);
}, arguments) };

export function __wbg_isBuffer_ed677b3a61a8ec61() { return logError(function (arg0, arg1) {
    var ret = getObject(arg0).isBuffer(getObject(arg1));
    _assertBoolean(ret);
    return ret;
}, arguments) };

export function __wbg_isProgram_f1a948be913510a2() { return logError(function (arg0, arg1) {
    var ret = getObject(arg0).isProgram(getObject(arg1));
    _assertBoolean(ret);
    return ret;
}, arguments) };

export function __wbg_isShader_af8ac592be6d7d25() { return logError(function (arg0, arg1) {
    var ret = getObject(arg0).isShader(getObject(arg1));
    _assertBoolean(ret);
    return ret;
}, arguments) };

export function __wbg_isTexture_0a54cd888e28b7d4() { return logError(function (arg0, arg1) {
    var ret = getObject(arg0).isTexture(getObject(arg1));
    _assertBoolean(ret);
    return ret;
}, arguments) };

export function __wbg_lineWidth_746cfe89cf518ba5() { return logError(function (arg0, arg1) {
    getObject(arg0).lineWidth(arg1);
}, arguments) };

export function __wbg_linkProgram_7080c84b0233cea2() { return logError(function (arg0, arg1) {
    getObject(arg0).linkProgram(getObject(arg1));
}, arguments) };

export function __wbg_pixelStorei_3cd96723ae22a5c6() { return logError(function (arg0, arg1, arg2) {
    getObject(arg0).pixelStorei(arg1 >>> 0, arg2);
}, arguments) };

export function __wbg_renderbufferStorage_25ffeed5caa0cc7c() { return logError(function (arg0, arg1, arg2, arg3, arg4) {
    getObject(arg0).renderbufferStorage(arg1 >>> 0, arg2 >>> 0, arg3, arg4);
}, arguments) };

export function __wbg_scissor_35fe98c7da06091c() { return logError(function (arg0, arg1, arg2, arg3, arg4) {
    getObject(arg0).scissor(arg1, arg2, arg3, arg4);
}, arguments) };

export function __wbg_shaderSource_67b991301db003d0() { return logError(function (arg0, arg1, arg2, arg3) {
    getObject(arg0).shaderSource(getObject(arg1), getStringFromWasm0(arg2, arg3));
}, arguments) };

export function __wbg_texParameteri_bd724f6a5ad0cbbc() { return logError(function (arg0, arg1, arg2, arg3) {
    getObject(arg0).texParameteri(arg1 >>> 0, arg2 >>> 0, arg3);
}, arguments) };

export function __wbg_uniform1i_0811c29c0eebe191() { return logError(function (arg0, arg1, arg2) {
    getObject(arg0).uniform1i(getObject(arg1), arg2);
}, arguments) };

export function __wbg_uniform2f_c4c110dee7f069e7() { return logError(function (arg0, arg1, arg2, arg3) {
    getObject(arg0).uniform2f(getObject(arg1), arg2, arg3);
}, arguments) };

export function __wbg_uniform3f_59a78bb22695e480() { return logError(function (arg0, arg1, arg2, arg3, arg4) {
    getObject(arg0).uniform3f(getObject(arg1), arg2, arg3, arg4);
}, arguments) };

export function __wbg_uniform4f_c9cd7c0b5febd8e2() { return logError(function (arg0, arg1, arg2, arg3, arg4, arg5) {
    getObject(arg0).uniform4f(getObject(arg1), arg2, arg3, arg4, arg5);
}, arguments) };

export function __wbg_useProgram_b72b0bfcbc720fa9() { return logError(function (arg0, arg1) {
    getObject(arg0).useProgram(getObject(arg1));
}, arguments) };

export function __wbg_vertexAttribPointer_b5cb524c6fe9eec8() { return logError(function (arg0, arg1, arg2, arg3, arg4, arg5, arg6) {
    getObject(arg0).vertexAttribPointer(arg1 >>> 0, arg2, arg3 >>> 0, arg4 !== 0, arg5, arg6);
}, arguments) };

export function __wbg_viewport_89af3aceb7036a2c() { return logError(function (arg0, arg1, arg2, arg3, arg4) {
    getObject(arg0).viewport(arg1, arg2, arg3, arg4);
}, arguments) };

export function __wbg_error_a8f9d6c85b89d485() { return logError(function (arg0, arg1) {
    console.error(getObject(arg0), getObject(arg1));
}, arguments) };

export function __wbg_tabIndex_abfeafcffb8040c2() { return logError(function (arg0) {
    var ret = getObject(arg0).tabIndex;
    _assertNum(ret);
    return ret;
}, arguments) };

export function __wbg_settabIndex_5ad6742502462dcf() { return logError(function (arg0, arg1) {
    getObject(arg0).tabIndex = arg1;
}, arguments) };

export function __wbg_offsetWidth_69cd6669725b154f() { return logError(function (arg0) {
    var ret = getObject(arg0).offsetWidth;
    _assertNum(ret);
    return ret;
}, arguments) };

export function __wbg_offsetHeight_8da312843e7777ab() { return logError(function (arg0) {
    var ret = getObject(arg0).offsetHeight;
    _assertNum(ret);
    return ret;
}, arguments) };

export function __wbg_now_559193109055ebad() { return logError(function (arg0) {
    var ret = getObject(arg0).now();
    return ret;
}, arguments) };

export function __wbg_identifier_87ee1c4654593a75() { return logError(function (arg0) {
    var ret = getObject(arg0).identifier;
    _assertNum(ret);
    return ret;
}, arguments) };

export function __wbg_clientX_cef1cde3d41e3cbf() { return logError(function (arg0) {
    var ret = getObject(arg0).clientX;
    _assertNum(ret);
    return ret;
}, arguments) };

export function __wbg_clientY_87cfa30c529cf50e() { return logError(function (arg0) {
    var ret = getObject(arg0).clientY;
    _assertNum(ret);
    return ret;
}, arguments) };

export function __wbg_instanceof_HtmlCanvasElement_25d964a0dde6717e() { return logError(function (arg0) {
    var ret = getObject(arg0) instanceof HTMLCanvasElement;
    _assertBoolean(ret);
    return ret;
}, arguments) };

export function __wbg_setwidth_c1a7061891b71f25() { return logError(function (arg0, arg1) {
    getObject(arg0).width = arg1 >>> 0;
}, arguments) };

export function __wbg_setheight_88894b05710ff752() { return logError(function (arg0, arg1) {
    getObject(arg0).height = arg1 >>> 0;
}, arguments) };

export function __wbg_getContext_f701d0231ae22393() { return handleError(function (arg0, arg1, arg2) {
    var ret = getObject(arg0).getContext(getStringFromWasm0(arg1, arg2));
    return isLikeNone(ret) ? 0 : addHeapObject(ret);
}, arguments) };

export function __wbg_altKey_3dcb50d5afbc5036() { return logError(function (arg0) {
    var ret = getObject(arg0).altKey;
    _assertBoolean(ret);
    return ret;
}, arguments) };

export function __wbg_ctrlKey_fb62ba10b63b34a4() { return logError(function (arg0) {
    var ret = getObject(arg0).ctrlKey;
    _assertBoolean(ret);
    return ret;
}, arguments) };

export function __wbg_shiftKey_bd2875540e5db840() { return logError(function (arg0) {
    var ret = getObject(arg0).shiftKey;
    _assertBoolean(ret);
    return ret;
}, arguments) };

export function __wbg_metaKey_94ca09e07f21f240() { return logError(function (arg0) {
    var ret = getObject(arg0).metaKey;
    _assertBoolean(ret);
    return ret;
}, arguments) };

export function __wbg_key_10dcaa4bb6d5449f() { return logError(function (arg0, arg1) {
    var ret = getObject(arg1).key;
    var ptr0 = passStringToWasm0(ret, wasm.__wbindgen_malloc, wasm.__wbindgen_realloc);
    var len0 = WASM_VECTOR_LEN;
    getInt32Memory0()[arg0 / 4 + 1] = len0;
    getInt32Memory0()[arg0 / 4 + 0] = ptr0;
}, arguments) };

export function __wbg_addEventListener_52721772cc0a7f30() { return handleError(function (arg0, arg1, arg2, arg3) {
    getObject(arg0).addEventListener(getStringFromWasm0(arg1, arg2), getObject(arg3));
}, arguments) };

export function __wbg_removeEventListener_f2adc9b2b318de99() { return handleError(function (arg0, arg1, arg2, arg3) {
    getObject(arg0).removeEventListener(getStringFromWasm0(arg1, arg2), getObject(arg3));
}, arguments) };

export function __wbg_changedTouches_d84714496e7f4712() { return logError(function (arg0) {
    var ret = getObject(arg0).changedTouches;
    return addHeapObject(ret);
}, arguments) };

export function __wbg_altKey_7cfb90a08ce4db73() { return logError(function (arg0) {
    var ret = getObject(arg0).altKey;
    _assertBoolean(ret);
    return ret;
}, arguments) };

export function __wbg_metaKey_49d641fb7c6fd755() { return logError(function (arg0) {
    var ret = getObject(arg0).metaKey;
    _assertBoolean(ret);
    return ret;
}, arguments) };

export function __wbg_ctrlKey_2008616a1339c848() { return logError(function (arg0) {
    var ret = getObject(arg0).ctrlKey;
    _assertBoolean(ret);
    return ret;
}, arguments) };

export function __wbg_shiftKey_aa89958b58ad5242() { return logError(function (arg0) {
    var ret = getObject(arg0).shiftKey;
    _assertBoolean(ret);
    return ret;
}, arguments) };

export function __wbg_self_86b4b13392c7af56() { return handleError(function () {
    var ret = self.self;
    return addHeapObject(ret);
}, arguments) };

export function __wbg_msCrypto_9ad6677321a08dd8() { return logError(function (arg0) {
    var ret = getObject(arg0).msCrypto;
    return addHeapObject(ret);
}, arguments) };

export function __wbg_crypto_b8c92eaac23d0d80() { return logError(function (arg0) {
    var ret = getObject(arg0).crypto;
    return addHeapObject(ret);
}, arguments) };

export function __wbg_getRandomValues_dd27e6b0652b3236() { return logError(function (arg0) {
    var ret = getObject(arg0).getRandomValues;
    return addHeapObject(ret);
}, arguments) };

export function __wbg_getRandomValues_e57c9b75ddead065() { return logError(function (arg0, arg1) {
    getObject(arg0).getRandomValues(getObject(arg1));
}, arguments) };

export function __wbg_randomFillSync_d2ba53160aec6aba() { return logError(function (arg0, arg1, arg2) {
    getObject(arg0).randomFillSync(getArrayU8FromWasm0(arg1, arg2));
}, arguments) };

export function __wbg_static_accessor_MODULE_452b4680e8614c81() { return logError(function () {
    var ret = module;
    return addHeapObject(ret);
}, arguments) };

export function __wbg_require_f5521a5b85ad2542() { return logError(function (arg0, arg1, arg2) {
    var ret = getObject(arg0).require(getStringFromWasm0(arg1, arg2));
    return addHeapObject(ret);
}, arguments) };

export function __wbindgen_is_undefined(arg0) {
    var ret = getObject(arg0) === undefined;
    _assertBoolean(ret);
    return ret;
};

export function __wbg_newnoargs_be86524d73f67598() { return logError(function (arg0, arg1) {
    var ret = new Function(getStringFromWasm0(arg0, arg1));
    return addHeapObject(ret);
}, arguments) };

export function __wbg_call_888d259a5fefc347() { return handleError(function (arg0, arg1) {
    var ret = getObject(arg0).call(getObject(arg1));
    return addHeapObject(ret);
}, arguments) };

export function __wbg_globalThis_3f735a5746d41fbd() { return handleError(function () {
    var ret = globalThis.globalThis;
    return addHeapObject(ret);
}, arguments) };

export function __wbg_self_c6fbdfc2918d5e58() { return handleError(function () {
    var ret = self.self;
    return addHeapObject(ret);
}, arguments) };

export function __wbg_window_baec038b5ab35c54() { return handleError(function () {
    var ret = window.window;
    return addHeapObject(ret);
}, arguments) };

export function __wbg_global_1bc0b39582740e95() { return handleError(function () {
    var ret = global.global;
    return addHeapObject(ret);
}, arguments) };

export function __wbg_newwithbyteoffsetandlength_12c9ea92e6bd82ab() { return logError(function (arg0, arg1, arg2) {
    var ret = new Int8Array(getObject(arg0), arg1 >>> 0, arg2 >>> 0);
    return addHeapObject(ret);
}, arguments) };

export function __wbg_newwithbyteoffsetandlength_cb1946ef06ced7aa() { return logError(function (arg0, arg1, arg2) {
    var ret = new Int16Array(getObject(arg0), arg1 >>> 0, arg2 >>> 0);
    return addHeapObject(ret);
}, arguments) };

export function __wbg_newwithbyteoffsetandlength_c6cf704931530b90() { return logError(function (arg0, arg1, arg2) {
    var ret = new Int32Array(getObject(arg0), arg1 >>> 0, arg2 >>> 0);
    return addHeapObject(ret);
}, arguments) };

export function __wbg_new_a7ce447f15ff496f() { return logError(function (arg0) {
    var ret = new Uint8Array(getObject(arg0));
    return addHeapObject(ret);
}, arguments) };

export function __wbg_newwithlength_929232475839a482() { return logError(function (arg0) {
    var ret = new Uint8Array(arg0 >>> 0);
    return addHeapObject(ret);
}, arguments) };

export function __wbg_newwithbyteoffsetandlength_4b9b8c4e3f5adbff() { return logError(function (arg0, arg1, arg2) {
    var ret = new Uint8Array(getObject(arg0), arg1 >>> 0, arg2 >>> 0);
    return addHeapObject(ret);
}, arguments) };

export function __wbg_subarray_8b658422a224f479() { return logError(function (arg0, arg1, arg2) {
    var ret = getObject(arg0).subarray(arg1 >>> 0, arg2 >>> 0);
    return addHeapObject(ret);
}, arguments) };

export function __wbg_length_1eb8fc608a0d4cdb() { return logError(function (arg0) {
    var ret = getObject(arg0).length;
    _assertNum(ret);
    return ret;
}, arguments) };

export function __wbg_set_969ad0a60e51d320() { return logError(function (arg0, arg1, arg2) {
    getObject(arg0).set(getObject(arg1), arg2 >>> 0);
}, arguments) };

export function __wbg_newwithbyteoffsetandlength_63181699967b1b75() { return logError(function (arg0, arg1, arg2) {
    var ret = new Uint16Array(getObject(arg0), arg1 >>> 0, arg2 >>> 0);
    return addHeapObject(ret);
}, arguments) };

export function __wbg_newwithbyteoffsetandlength_4bc6fc57887d7f72() { return logError(function (arg0, arg1, arg2) {
    var ret = new Uint32Array(getObject(arg0), arg1 >>> 0, arg2 >>> 0);
    return addHeapObject(ret);
}, arguments) };

export function __wbg_newwithbyteoffsetandlength_8bd669b4092b7244() { return logError(function (arg0, arg1, arg2) {
    var ret = new Float32Array(getObject(arg0), arg1 >>> 0, arg2 >>> 0);
    return addHeapObject(ret);
}, arguments) };

export function __wbg_buffer_397eaa4d72ee94dd() { return logError(function (arg0) {
    var ret = getObject(arg0).buffer;
    return addHeapObject(ret);
}, arguments) };

export function __wbg_get_4d0f21c2f823742e() { return handleError(function (arg0, arg1) {
    var ret = Reflect.get(getObject(arg0), getObject(arg1));
    return addHeapObject(ret);
}, arguments) };

export function __wbindgen_debug_string(arg0, arg1) {
    var ret = debugString(getObject(arg1));
    var ptr0 = passStringToWasm0(ret, wasm.__wbindgen_malloc, wasm.__wbindgen_realloc);
    var len0 = WASM_VECTOR_LEN;
    getInt32Memory0()[arg0 / 4 + 1] = len0;
    getInt32Memory0()[arg0 / 4 + 0] = ptr0;
};

export function __wbindgen_throw(arg0, arg1) {
    throw new Error(getStringFromWasm0(arg0, arg1));
};

export function __wbindgen_rethrow(arg0) {
    throw takeObject(arg0);
};

export function __wbindgen_memory() {
    var ret = wasm.memory;
    return addHeapObject(ret);
};

export function __wbindgen_closure_wrapper1996() { return logError(function (arg0, arg1, arg2) {
    var ret = makeMutClosure(arg0, arg1, 25, __wbg_adapter_24);
    return addHeapObject(ret);
}, arguments) };

export function __wbindgen_closure_wrapper4742() { return logError(function (arg0, arg1, arg2) {
    var ret = makeMutClosure(arg0, arg1, 96, __wbg_adapter_27);
    return addHeapObject(ret);
}, arguments) };

export function __wbindgen_closure_wrapper4744() { return logError(function (arg0, arg1, arg2) {
    var ret = makeMutClosure(arg0, arg1, 104, __wbg_adapter_30);
    return addHeapObject(ret);
}, arguments) };

export function __wbindgen_closure_wrapper4746() { return logError(function (arg0, arg1, arg2) {
    var ret = makeMutClosure(arg0, arg1, 100, __wbg_adapter_33);
    return addHeapObject(ret);
}, arguments) };

export function __wbindgen_closure_wrapper4748() { return logError(function (arg0, arg1, arg2) {
    var ret = makeMutClosure(arg0, arg1, 98, __wbg_adapter_36);
    return addHeapObject(ret);
}, arguments) };

export function __wbindgen_closure_wrapper4750() { return logError(function (arg0, arg1, arg2) {
    var ret = makeMutClosure(arg0, arg1, 102, __wbg_adapter_39);
    return addHeapObject(ret);
}, arguments) };

