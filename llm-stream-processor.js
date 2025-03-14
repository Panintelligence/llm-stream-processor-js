/**
 * LlmStreamProcessor
 *
 * A lightweight utility for processing streaming responses from Large Language Models (LLMs).
 * Specifically designed to handle <think> blocks and content separation with support for
 * Server-Sent Events (SSE) common in LLM API responses.
 */
class LlmStreamProcessor {
    /**
     * Creates a new LlmStreamProcessor instance
     *
     * @param {Object} options - Configuration options
     * @param {string} [options.chunkPrefix] - Prefix to strip from each chunk (e.g., "data: ")
     * @param {string} [options.endDelimiter] - String that signals the end of the stream (e.g., "[DONE]")
     */
    constructor(options = {}) {
        // State tracking
        this.isProcessingStarted = false;
        this.isThinkStarted = false;
        this.isContentStarted = false;
        this.isCompleted = false;

        // Content accumulation
        this.thinkBuffer = '';
        this.contentBuffer = '';
        this.rawBuffer = '';

        // Callback storage
        this.onStart = null;
        this.onThinkStart = null;
        this.onThinkChunk = null;
        this.onThinkFinish = null;
        this.onContentStart = null;
        this.onContentChunk = null;
        this.onContentFinish = null;
        this.onFinish = null;
        this.onFailure = null;

        // Configuration options
        this.chunkPrefix = options.chunkPrefix || '';
        this.endDelimiter = options.endDelimiter || '';

        // Constants
        this.THINK_OPEN = '<think>';
        this.THINK_CLOSE = '</think>';
    }

    /**
     * Factory method to create a new instance
     *
     * @param {Object} options - Configuration options
     * @param {string} [options.chunkPrefix] - Prefix to strip from each chunk (e.g., "data: ")
     * @param {string} [options.endDelimiter] - String that signals the end of the stream (e.g., "[DONE]")
     * @returns {LlmStreamProcessor} A new LlmStreamProcessor instance
     */
    static createInstance(options = {}) {
        return new LlmStreamProcessor(options);
    }

    /**
     * Process raw server response that may contain multiple JSON-formatted messages.
     * This method extracts content from structured server responses before processing.
     *
     * USE THIS METHOD when working directly with raw server responses containing JSON.
     *
     * @param {string} rawChunk - Raw server chunk response potentially containing multiple JSON messages
     * @param {Function} onStart - Called when processing begins
     * @param {Function} onThinkStart - Called when a think block starts
     * @param {Function} onThinkChunk - Called with each chunk inside a think block
     * @param {Function} onThinkFinish - Called when a think block completes
     * @param {Function} onContentStart - Called when content outside think blocks starts
     * @param {Function} onContentChunk - Called with each chunk outside think blocks
     * @param {Function} onContentFinish - Called when content is finished
     * @param {Function} onFinish - Called when all processing is complete
     * @param {Function} onFailure - Called if an error occurs
     */
    processChunk(rawChunk,
                 onStart,
                 onThinkStart,
                 onThinkChunk,
                 onThinkFinish,
                 onContentStart,
                 onContentChunk,
                 onContentFinish,
                 onFinish,
                 onFailure) {
        const chunk = LlmStreamProcessor.extractChunk(rawChunk);
        this.read(chunk, onStart,
            onThinkStart,
            onThinkChunk,
            onThinkFinish,
            onContentStart,
            onContentChunk,
            onContentFinish,
            onFinish,
            onFailure);
    }

    /**
     * Process pre-extracted text content, identifying think blocks and regular content.
     * Unlike processChunk(), this expects plain text content, not raw JSON responses.
     *
     * Use this method only if you've already extracted content from server responses.
     *
     * @param {string} chunk - The chunk of text to process
     * @param {Function} onStart - Called when processing begins
     * @param {Function} onThinkStart - Called when a think block starts
     * @param {Function} onThinkChunk - Called with each chunk inside a think block
     * @param {Function} onThinkFinish - Called when a think block completes
     * @param {Function} onContentStart - Called when content outside think blocks starts
     * @param {Function} onContentChunk - Called with each chunk outside think blocks
     * @param {Function} onContentFinish - Called when content is finished
     * @param {Function} onFinish - Called when all processing is complete
     * @param {Function} onFailure - Called if an error occurs
     */
    read(chunk,
         onStart,
         onThinkStart,
         onThinkChunk,
         onThinkFinish,
         onContentStart,
         onContentChunk,
         onContentFinish,
         onFinish,
         onFailure) {

        try {
            // Store callbacks for later use (especially in finalize)
            this.onStart = onStart;
            this.onThinkStart = onThinkStart;
            this.onThinkChunk = onThinkChunk;
            this.onThinkFinish = onThinkFinish;
            this.onContentStart = onContentStart;
            this.onContentChunk = onContentChunk;
            this.onContentFinish = onContentFinish;
            this.onFinish = onFinish;
            this.onFailure = onFailure;

            // Process end delimiter if present
            if (this.endDelimiter && chunk.includes(this.endDelimiter)) {
                // Remove the end delimiter and process the rest
                chunk = chunk.replace(this.endDelimiter, '');

                // If the chunk is now empty after removing the delimiter, skip processing
                if (chunk.trim() === '') {
                    this.finalize();
                    return;
                }
            }

            // Strip chunk prefix if configured
            if (this.chunkPrefix && chunk.startsWith(this.chunkPrefix)) {
                chunk = chunk.substring(this.chunkPrefix.length);
            }

            // Add chunk to raw buffer
            this.rawBuffer += chunk;

            // Start processing if not already started
            if (!this.isProcessingStarted) {
                this.isProcessingStarted = true;
                if (onStart) onStart();
            }

            let remainingChunk = chunk;
            let currentPosition = 0;

            while (currentPosition < remainingChunk.length) {
                // Look for think open tag in the current chunk
                if (!this.isThinkStarted) {
                    const openTagPosition = remainingChunk.indexOf(this.THINK_OPEN, currentPosition);

                    if (openTagPosition !== -1) {
                        // We found an opening tag

                        // Process any content before the tag
                        if (openTagPosition > currentPosition) {
                            const contentBeforeTag = remainingChunk.substring(currentPosition, openTagPosition);
                            this.processContentChunk(contentBeforeTag);
                        }

                        // Move past the opening tag
                        currentPosition = openTagPosition + this.THINK_OPEN.length;

                        // Start think block
                        this.isThinkStarted = true;
                        if (onThinkStart) onThinkStart();
                        continue;
                    } else {
                        // No opening tag found, process the rest as regular content
                        const remainingContent = remainingChunk.substring(currentPosition);
                        this.processContentChunk(remainingContent);
                        break; // Done with this chunk
                    }
                }

                // Look for think close tag if we're in a think block
                if (this.isThinkStarted) {
                    const closeTagPosition = remainingChunk.indexOf(this.THINK_CLOSE, currentPosition);

                    if (closeTagPosition !== -1) {
                        // We found a closing tag

                        // Process any think content before the tag
                        if (closeTagPosition > currentPosition) {
                            const thinkContent = remainingChunk.substring(currentPosition, closeTagPosition);
                            this.processThinkChunk(thinkContent);
                        }

                        // Move past the closing tag
                        currentPosition = closeTagPosition + this.THINK_CLOSE.length;

                        // End think block and notify
                        this.isThinkStarted = false;
                        if (onThinkFinish) onThinkFinish(this.thinkBuffer);

                        // Start content if not already started for upcoming non-think content
                        this.ensureContentStarted();
                        continue;
                    } else {
                        // No closing tag found, process the rest as think content
                        const remainingThinkContent = remainingChunk.substring(currentPosition);
                        this.processThinkChunk(remainingThinkContent);
                        break; // Done with this chunk
                    }
                }
            }
        } catch (error) {
            if (onFailure) onFailure(error);
        }
    }

    /**
     * Process a chunk of think block content
     *
     * @param {string} chunk - The think content chunk to process
     * @private
     */
    processThinkChunk(chunk) {
        if (chunk && chunk.length > 0) {
            this.thinkBuffer += chunk;
            if (this.onThinkChunk) {
                this.onThinkChunk(chunk); // Send only the new chunk
            }
        }
    }

    /**
     * Process a chunk of content outside think blocks
     *
     * @param {string} chunk - The content chunk to process
     * @private
     */
    processContentChunk(chunk) {
        if (chunk && chunk.length > 0) {
            this.ensureContentStarted();
            this.contentBuffer += chunk;
            if (this.onContentChunk) {
                this.onContentChunk(chunk); // Send only the new chunk
            }
        }
    }

    /**
     * Ensure content processing has started
     *
     * @private
     */
    ensureContentStarted() {
        if (!this.isContentStarted) {
            this.isContentStarted = true;
            if (this.onContentStart) this.onContentStart();
        }
    }

    /**
     * Finalize processing, triggering appropriate completion callbacks.
     * Call this method when all chunks have been processed.
     */
    finalize() {
        if (this.isCompleted) return;

        try {
            // If still in a think block, close it
            if (this.isThinkStarted) {
                this.isThinkStarted = false;
                if (this.onThinkFinish) this.onThinkFinish(this.thinkBuffer);
            }

            // Ensure content processing is marked as started
            this.ensureContentStarted();

            // Trigger content finished callback
            let parsedJson = null;
            try {
                // First try to extract JSON content if enclosed in ```json blocks
                const jsonMatch = this.contentBuffer.match(/```json\s*([\s\S]*?)\s*```/);
                if (jsonMatch && jsonMatch[1]) {
                    parsedJson = JSON.parse(jsonMatch[1].trim());
                } else {
                    // Otherwise try to parse the entire content as JSON
                    parsedJson = JSON.parse(this.contentBuffer.trim());
                }
            } catch (e) {
                // Silent fail - parsedJson remains null if parsing fails
            }

            // Critical fix: Call the content finished callback
            if (this.onContentFinish) {
                this.onContentFinish(this.contentBuffer, parsedJson);
            }

            // Mark as completed and trigger completion callback
            this.isCompleted = true;
            if (this.onFinish) {
                this.onFinish(this.thinkBuffer, this.contentBuffer, parsedJson);
            }
        } catch (error) {
            if (this.onFailure) this.onFailure(error);
        }
    }

    /**
     * Extract content from raw chunks that might contain JSON structures.
     * Be aware that the input can be as below, with multiple messages received as one chunk:
     * ```
     * {"message":{"role":"assistant","content":"<think>"},"done":false,"index":0}
     * {"message":{"role":"assistant","content":"\n"},"done":false,"index":1}
     * ```
     *
     * @param {string} chunkText - Raw text possibly containing JSON structures
     * @returns {string} The extracted content
     * @static
     */
    static extractChunk(chunkText) {
        const lines = chunkText.split('\n').map(LlmStreamProcessor.cleanLine).filter(line => (line || '').trim() !== '');

        const fns = [
            (json) => json['message']['content'], // same as ollama, most common json format
            (json) => json['choices'][0]['delta']['content'], // this is the openai solution
            (json) => json['response'], // ollama old solution
        ];

        let result = '';

        for (const line of lines) {
            const chunkJson = LlmStreamProcessor.stringToJson(line);
            for (const fn of fns) {
                let content;
                try {
                    content = fn(chunkJson) || '';
                } catch (ignore) {
                    content = null;
                }
                if (content) {
                    result += content;
                    break;
                }
            }
        }

        return result;
    }

    /**
     * Clean a line of text, removing SSE prefixes and end delimiters
     *
     * @param {string} text - A line of text to clean
     * @returns {string|null} The cleaned line or null if empty
     * @static
     * @private
     */
    static cleanLine(text) {
        if (!text) return null;
        const t1 = text.startsWith("data: ") ? text.substring(6) : text;
        return t1.replace(/data: \[DONE\]$/, '');
    }

    /**
     * Safely parse a JSON string, returning an empty object if parsing fails
     *
     * @param {string} jsonString - The string to parse as JSON
     * @returns {Object} The parsed JSON object or an empty object if parsing fails
     * @static
     * @private
     */
    static stringToJson(jsonString) {
        try {
            return JSON.parse(jsonString);
        } catch (error) {
            return {};
        }
    }
}
