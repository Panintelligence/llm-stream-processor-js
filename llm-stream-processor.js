/**
 * Processes streaming responses from LLM APIs, handling think blocks and content.
 * Parses the stream for <think> and </think> tags and accumulates text appropriately.
 */
class LlmStreamProcessor {
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
        this.onProcessingStarted = null;
        this.onThinkStarted = null;
        this.onThinkChunk = null;
        this.onThinkCompleted = null;
        this.onContentStarted = null;
        this.onContentChunk = null;
        this.onContentFinished = null;
        this.onAllCompleted = null;
        this.onError = null;

        // Configuration options
        this.chunkPrefix = options.chunkPrefix || '';
        this.endDelimiter = options.endDelimiter || '';

        // Constants
        this.THINK_OPEN = '<think>';
        this.THINK_CLOSE = '</think>';
    }

    /**
     * Factory method to create a new instance
     * @param {Object} options - Configuration options
     * @param {string} [options.chunkPrefix] - Prefix to strip from each chunk (e.g., "data: ")
     * @param {string} [options.endDelimiter] - String that signals the end of the stream (e.g., "[DONE]")
     * @returns {LlmStreamProcessor} A new LlmStreamProcessor instance
     */
    static createInstance(options = {}) {
        return new LlmStreamProcessor(options);
    }

    /**
     * Process a chunk of data from the stream
     *
     * @param {string} chunk - The chunk of text to process
     * @param {Function} onProcessingStarted - Called when processing begins
     * @param {Function} onThinkStarted - Called when a think block starts
     * @param {Function} onThinkChunk - Called with each chunk inside a think block
     * @param {Function} onThinkCompleted - Called when a think block completes
     * @param {Function} onContentStarted - Called when content outside think blocks starts
     * @param {Function} onContentChunk - Called with each chunk outside think blocks
     * @param {Function} onContentFinished - Called when content is finished
     * @param {Function} onAllCompleted - Called when all processing is complete
     * @param {Function} onError - Called if an error occurs
     */
    read(chunk,
         onProcessingStarted,
         onThinkStarted,
         onThinkChunk,
         onThinkCompleted,
         onContentStarted,
         onContentChunk,
         onContentFinished,
         onAllCompleted,
         onError) {

        try {
            // Store callbacks for later use (especially in finalize)
            this.onProcessingStarted = onProcessingStarted;
            this.onThinkStarted = onThinkStarted;
            this.onThinkChunk = onThinkChunk;
            this.onThinkCompleted = onThinkCompleted;
            this.onContentStarted = onContentStarted;
            this.onContentChunk = onContentChunk;
            this.onContentFinished = onContentFinished;
            this.onAllCompleted = onAllCompleted;
            this.onError = onError;

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
                if (onProcessingStarted) onProcessingStarted();
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
                        if (onThinkStarted) onThinkStarted();
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
                        if (onThinkCompleted) onThinkCompleted(this.thinkBuffer);

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
            if (onError) onError(error);
        }
    }

    /**
     * Process a chunk of think block content
     * @param {string} chunk The think content chunk to process
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
     * @param {string} chunk The content chunk to process
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
     */
    ensureContentStarted() {
        if (!this.isContentStarted) {
            this.isContentStarted = true;
            if (this.onContentStarted) this.onContentStarted();
        }
    }

    /**
     * Finalize processing, triggering appropriate completion callbacks
     */
    finalize() {
        if (this.isCompleted) return;

        try {
            // If still in a think block, close it
            if (this.isThinkStarted) {
                this.isThinkStarted = false;
                if (this.onThinkCompleted) this.onThinkCompleted(this.thinkBuffer);
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
            if (this.onContentFinished) {
                this.onContentFinished(this.contentBuffer, parsedJson);
            }

            // Mark as completed and trigger completion callback
            this.isCompleted = true;
            if (this.onAllCompleted) {
                this.onAllCompleted(this.thinkBuffer, this.contentBuffer, parsedJson);
            }
        } catch (error) {
            if (this.onError) this.onError(error);
        }
    }
}
