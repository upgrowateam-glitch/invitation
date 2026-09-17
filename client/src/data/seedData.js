import { v4 as uuidv4 } from 'uuid';

export const seedData = {
  users: [
    { id: 1, name: 'Demo Super Admin', email: 'admin@demo.com', password: 'Admin@123', role: 'SUPER_ADMIN', isActive: true },
    { id: 2, name: 'Rahul Sharma (Sender)', email: 'rahul@bnigems.com', password: 'password123', role: 'SENDER', isActive: true },
    { id: 3, name: 'Priya Desai (Sender)', email: 'priya@bnigems.com', password: 'password123', role: 'SENDER', isActive: true }
  ],
  invitations: [
    {
      id: 1,
      creatorId: 1,
      title: 'BNI Gems Chapter - 100 Crore Celebration',
      description: 'Join us to celebrate a historic milestone of BNI Gems Kannur reaching 100 Crores!',
      eventDate: new Date(Date.now() + 15 * 24 * 60 * 60 * 1000).toISOString(),
      startTime: '18:00',
      endTime: '22:00',
      venueName: 'BNI Gems Kannur',
      address: 'Kannur, Kerala',
      googleMapsLink: 'https://maps.google.com',
      hostName: 'BNI Gems Kannur',
      allowGuests: true,
      allowResponseEdit: true,
      status: 'ACTIVE'
    }
  ],
  recipients: [],
  templates: [
    {
      id: 1,
      name: 'BNI Default Template',
      fields: [
        {
          fieldType: 'RECIPIENT_NAME',
          pageNumber: 1,
          xPosition: 0.5, // Center horizontal
          yPosition: 0.45, // Roughly middle-lower part of the page, will need adjustment
          fontSize: 32,
          fontFamily: 'Helvetica-Bold',
          textAlign: 'center',
          fontColor: '#DC2626' // Red
        }
      ]
    }
  ],
  activities: []
};
