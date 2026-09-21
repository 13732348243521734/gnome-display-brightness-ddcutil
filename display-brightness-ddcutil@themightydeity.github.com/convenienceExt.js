import Gio from 'gi://Gio';

export function isNullOrWhitespace(str) {
    return str === undefined || str === null || str.match(/^\s*$/) !== null;
}

/**
 * 
 * @param {*} settings 
 * @param {*} str 
 */
export function brightnessLog(settings, ...args) {
    if (settings.get_boolean('verbose-debugging'))
        console.log(`display-brightness-ddcutil extension: `, ...args);
}

export function spawnWithCallback(settings, argv, callback) {
    brightnessLog(settings, `Calling: ${argv.join(' ')}`);
    /*
        communicate_utf8_async() only returns a Promise (auto-promisified by GJS)
        when called WITHOUT an explicit callback argument. Here we pass one, so it
        uses the classic GAsyncReadyCallback pattern and returns void immediately -
        `await`ing it does NOT wait for the subprocess to finish. That silently
        let callers (which assume `await spawnWithCallback(...)` blocks until the
        callback has run) race ahead and spawn the next ddcutil process before the
        previous one completed. We wrap it in a real Promise so callers' `await`
        actually waits until `callback` (and everything it triggers) is done.
    */
    return new Promise(resolve => {
        try {
            const proc = Gio.Subprocess.new(argv, Gio.SubprocessFlags.STDOUT_PIPE | Gio.SubprocessFlags.STDERR_SILENCE);

            proc.communicate_utf8_async(null, null, async (proc, res) => {
                try {
                    const [, stdout, stderr] = proc.communicate_utf8_finish(res);
                    if (proc.get_successful()) {
                        await callback(stdout);
                    } else {
                        /*
                            errors from ddcutil (like monitor not found) were actually in stdout
                            only the process return code was 1
                        */
                        if (stderr)
                            await callback(stderr);
                        else if (stdout)
                            await callback(stdout);
                        else
                            await callback("");
                    }
                } catch (e) {
                    brightnessLog(settings, e);
                } finally {
                    resolve();
                }
            });
        } catch (e) {
            brightnessLog(settings, e);
            resolve();
        }
    });
}


/**
 * Filters a VCP Feature Codes output to make sure only valid lines are returned.
 *
 * @param {string} val The `getvcp` feature code output
 * @returns {string} An array containing valid VPC lines, e.g. 'VPC D6 SNC 0x1'
 */
export function getVCPInfoAsArray(val) {
    const matched = val.trim().match(/^VCP.*$/gm)
    if(matched !== null){
        return matched.join('\n').split(' ')
    }else{
        return []
    }
}

export function sliderValuePercentFixed(sliderValue){
    return Math.round(sliderValue * 100);
}