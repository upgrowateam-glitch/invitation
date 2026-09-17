import axios from 'axios';

export const pdfService = {
  async getTemplates() {
    const res = await axios.get('/api/templates');
    return res.data;
  },

  async saveTemplateFields(id, fields) {
    await axios.post(`/api/templates/${id}/fields`, { fields });
  },

  async generatePreview(templateId, recipientName, designConfiguration = null) {
    const res = await axios.post(`/api/templates/${templateId}/preview`, { 
      recipientName, 
      designConfiguration 
    });
    return res.data.url;
  }
};
