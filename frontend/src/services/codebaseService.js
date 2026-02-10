// API service for codebase management
import axios from './api';

export const codebaseService = {
    // Ingest a repository
    ingestRepository: async (owner, repo) => {
        const response = await axios.post('/codebases/ingest', { owner, repo });
        return response.data;
    },

    // Get all user's codebases
    getCodebases: async () => {
        const response = await axios.get('/codebases');
        return response.data;
    },

    // Get codebase by ID
    getCodebase: async (id) => {
        const response = await axios.get(`/codebases/${id}`);
        return response.data;
    },

    // Get files for a codebase (file tree)
    getCodebaseFiles: async (id) => {
        const response = await axios.get(`/codebases/${id}/files`);
        return response.data;
    },

    // Get file content
    getFileContent: async (codebaseId, fileId) => {
        const response = await axios.get(`/codebases/${codebaseId}/files/${fileId}`);
        return response.data;
    },

    // Get codebase status
    getCodebaseStatus: async (id) => {
        const response = await axios.get(`/codebases/${id}/status`);
        return response.data;
    },

    // Delete codebase
    deleteCodebase: async (id) => {
        const response = await axios.delete(`/codebases/${id}`);
        return response.data;
    },

    // Trigger AST parsing
    parseCodebase: async (id) => {
        const response = await axios.post(`/codebases/${id}/parse`);
        return response.data;
    },

    // Get code structure
    getCodeStructure: async (id) => {
        const response = await axios.get(`/codebases/${id}/structure`);
        return response.data;
    },

    // AI and Embedding APIs
    generateEmbeddings: async (id) => {
        const response = await axios.post(`/embeddings/codebases/${id}/generate`);
        return response.data;
    },

    getEmbeddingStats: async (id) => {
        const response = await axios.get(`/embeddings/codebases/${id}/stats`);
        return response.data;
    },

    semanticSearch: async (id, query, type = 'ALL', limit = 10) => {
        const response = await axios.post(`/search/codebases/${id}/semantic`, {
            query,
            type,
            limit
        });
        return response.data;
    },

    askQuestion: async (id, message, conversationId = null) => {
        const response = await axios.post(`/search/codebases/${id}/chat`, {
            message,
            conversationId
        });
        return response.data;
    },

    getConversation: async (conversationId) => {
        const response = await axios.get(`/search/conversations/${conversationId}`);
        return response.data;
    },

    clearConversation: async (conversationId) => {
        const response = await axios.delete(`/search/conversations/${conversationId}`);
        return response.data;
    },
};
