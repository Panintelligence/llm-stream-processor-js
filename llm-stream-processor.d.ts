/**
 * Configuration options for the LlmStreamProcessor
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
 * A lightweight utility for processing streaming responses from Large Language Models (LLMs).
 * Specifically designed to handle <think> blocks and content separation with support for
 * Server-Sent Events (SSE) common in LLM API responses.
 */
declare class LlmStreamProcessor {
    /**
     * Creates a new LlmStreamProcessor instance
     *
     * @param options - Configuration options
     */
    constructor(options?: LlmStreamProcessorOptions);

    /**
     * Factory method to create a new instance
     *
     * @param options - Configuration options
     * @returns A new LlmStreamProcessor instance
     */
    static createInstance(options?: LlmStreamProcessorOptions): LlmStreamProcessor;

    /**
     * Process raw server response that may contain multiple JSON-formatted messages.
     * This method extracts content from structured server responses before processing.
     *
     * USE THIS METHOD when working directly with raw server responses containing JSON.
     *
     * @param rawChunk - Raw server chunk response potentially containing multiple JSON messages
     * @param onStart - Called when processing begins
     * @param onThinkStart - Called when a think block starts
     * @param onThinkChunk - Called with each chunk inside a think block
     * @param onThinkFinish - Called when a think block completes
     * @param onContentStart - Called when content outside think blocks starts
     * @param onContentChunk - Called with each chunk outside think blocks
     * @param onContentFinish - Called when content is finished, with full content and any parsed JSON
     * @param onFinish - Called when all processing is complete
     * @param onFailure - Called if an error occurs
     */
    processChunk(
        rawChunk: string,
        onStart?: () => void,
        onThinkStart?: () => void,
        onThinkChunk?: (chunk: string) => void,
        onThinkFinish?: (fullThinkText: string) => void,
        onContentStart?: () => void,
        onContentChunk?: (chunk: string) => void,
        onContentFinish?: (fullContentText: string, parsedJson: any | null) => void,
        onFinish?: (fullThinkText: string, fullContentText: string, parsedJson: any | null) => void,
        onFailure?: (error: Error) => void
    ): void;

    /**
     * Process pre-extracted text content, identifying think blocks and regular content.
     * Unlike processChunk(), this expects plain text content, not raw JSON responses.
     *
     * @param chunk - The chunk of text to process
     * @param onStart - Called when processing begins
     * @param onThinkStart - Called when a think block starts
     * @param onThinkChunk - Called with each chunk inside a think block
     * @param onThinkFinish - Called when a think block completes
     * @param onContentStart - Called when content outside think blocks starts
     * @param onContentChunk - Called with each chunk outside think blocks
     * @param onContentFinish - Called when content is finished, with full content and any parsed JSON
     * @param onFinish - Called when all processing is complete
     * @param onFailure - Called if an error occurs
     */
    read(
        chunk: string,
        onStart?: () => void,
        onThinkStart?: () => void,
        onThinkChunk?: (chunk: string) => void,
        onThinkFinish?: (fullThinkText: string) => void,
        onContentStart?: () => void,
        onContentChunk?: (chunk: string) => void,
        onContentFinish?: (fullContentText: string, parsedJson: any | null) => void,
        onFinish?: (fullThinkText: string, fullContentText: string, parsedJson: any | null) => void,
        onFailure?: (error: Error) => void
    ): void;

    /**
     * Finalize processing, triggering appropriate completion callbacks.
     * Call this method when all chunks have been processed.
     */
    finalize(): void;

    /**
     * Extract content from raw chunks that might contain JSON structures.
     *
     * @param chunkText - Raw text possibly containing JSON structures
     * @returns The extracted content
     */
    static extractChunk(chunkText: string): string;
}

export = LlmStreamProcessor;