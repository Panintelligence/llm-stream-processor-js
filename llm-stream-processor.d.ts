/**
 * Configuration options for LlmStreamProcessor
 */
interface LlmStreamProcessorOptions {
    /**
     * Prefix to strip from each chunk (e.g., "data: ")
     */
    chunkPrefix?: string;

    /**
     * String that signals the end of the stream (e.g., "[DONE]")
     */
    endDelimiter?: string;
}

/**
 * Main class for processing LLM streaming responses
 * Handles <think> blocks and content streaming with callback-based processing
 */
declare class LlmStreamProcessor {
    /**
     * Creates a new LlmStreamProcessor instance
     *
     * @param options - Configuration options
     */
    static createInstance(options?: LlmStreamProcessorOptions): LlmStreamProcessor;

    /**
     * Processes a streaming response chunk with enhanced callback control
     *
     * @param chunk - The chunk of text from the streaming response
     * @param onStart - Called when processing begins
     * @param onThinkStart - Called when a think block starts
     * @param onThinkChunk - Called with new content from inside think blocks (only the new chunk)
     * @param onThinkFinish - Called when a think block ends with the full think text
     * @param onContentStart - Called when content (non-think) starts
     * @param onContentChunk - Called with new content outside think blocks (only the new chunk)
     * @param onContentFinish - Called with final content text and parsed JSON (null if not JSON)
     * @param onFinish - Called when all content is processed
     * @param onFailure - Called when an error occurs
     */
    read(
        chunk: string,
        onStart: () => void,
        onThinkStart: () => void,
        onThinkChunk: (chunk: string) => void,
        onThinkFinish: (fullThinkText: string) => void,
        onContentStart: () => void,
        onContentChunk: (chunk: string) => void,
        onContentFinish: (fullContentText: string, parsedJson: any | null) => void,
        onFinish: (fullThinkText: string, fullContentText: string, parsedJson: any | null) => void,
        onFailure: (error: Error) => void
    ): void;

    /**
     * Finalizes the processing and triggers completion callbacks
     * Call this method when you know the stream has completed
     * Uses the callbacks provided in the most recent read() call
     */
    finalize(): void;
}