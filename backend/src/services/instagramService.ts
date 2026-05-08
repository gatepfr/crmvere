import axios from 'axios';

const BASE_URL = 'https://graph.facebook.com/v21.0';

export class InstagramService {
  constructor(private accessToken: string) {}

  async sendDM(recipientIgsid: string, text: string) {
    const response = await axios.post(
      `${BASE_URL}/me/messages`,
      {
        recipient: { id: recipientIgsid },
        message: { text },
        messaging_type: 'RESPONSE',
      },
      { params: { access_token: this.accessToken } }
    );
    return response.data;
  }

  async sendDMWithQuickReplies(recipientIgsid: string, text: string, quickReplies: { title: string; payload: string }[]) {
    const response = await axios.post(
      `${BASE_URL}/me/messages`,
      {
        recipient: { id: recipientIgsid },
        message: {
          text,
          quick_replies: quickReplies.map(qr => ({
            content_type: 'text',
            title: qr.title,
            payload: qr.payload,
          })),
        },
        messaging_type: 'RESPONSE',
      },
      { params: { access_token: this.accessToken } }
    );
    return response.data;
  }

  async replyToComment(commentId: string, message: string) {
    const response = await axios.post(
      `${BASE_URL}/${commentId}/replies`,
      { message },
      { params: { access_token: this.accessToken } }
    );
    return response.data;
  }

  async getAccountInfo(accountId?: string) {
    const id = accountId || 'me';
    const response = await axios.get(`${BASE_URL}/${id}`, {
      params: { fields: 'id,name,username', access_token: this.accessToken },
    });
    return response.data;
  }
}
