# User Registration Frontend

A beautiful, responsive React application for collecting user information with AWS Amplify deployment support.

## Features

- Modern, responsive UI built with React and Tailwind CSS
- Form validation and error handling
- Beautiful gradient design with smooth animations
- API integration ready for backend connection
- Optimized for AWS Amplify deployment

## User Information Collected

- First Name
- Last Name
- Email Address
- Gender
- Sex
- Occupation

## Tech Stack

- **React** - UI framework
- **Vite** - Build tool and dev server
- **Tailwind CSS** - Styling framework
- **AWS Amplify** - Hosting and deployment

## Getting Started

### Prerequisites

- Node.js (v14 or higher)
- npm or yarn

### Installation

1. Install dependencies:
```bash
npm install
```

2. Create a `.env` file from the example:
```bash
cp .env.example .env
```

3. Update the `.env` file with your backend API URL:
```
VITE_API_URL=https://your-backend-api-url.com/api
```

### Development

Run the development server:
```bash
npm run dev
```

The application will be available at `http://localhost:5173`

### Build

Create a production build:
```bash
npm run build
```

The build output will be in the `dist` directory.

## AWS Amplify Deployment

### Step 1: Connect Repository

1. Go to [AWS Amplify Console](https://console.aws.amazon.com/amplify/)
2. Click "New app" > "Host web app"
3. Connect your Git repository (GitHub, GitLab, Bitbucket, or AWS CodeCommit)
4. Select the repository and branch

### Step 2: Configure Build Settings

The `amplify.yml` file is already configured for Vite. AWS Amplify will automatically detect it.

### Step 3: Set Environment Variables

In the Amplify Console:
1. Go to "App settings" > "Environment variables"
2. Add the following variable:
   - Key: `VITE_API_URL`
   - Value: Your backend API URL (e.g., `https://api.yourdomain.com/api`)

### Step 4: Deploy

1. Review the settings
2. Click "Save and deploy"
3. Amplify will build and deploy your application

### Continuous Deployment

Once set up, every push to your connected branch will automatically trigger a new deployment.

## API Integration

The frontend is configured to communicate with a backend API. Update the `VITE_API_URL` environment variable with your backend endpoint.

### API Endpoints Expected

- `POST /api/users` - Submit user information
- `GET /api/users` - Get all users (optional)
- `GET /api/health` - Health check (optional)

### Data Format

The frontend sends data in the following format:
```json
{
  "firstName": "string",
  "lastName": "string",
  "email": "string",
  "gender": "string",
  "sex": "string",
  "occupation": "string"
}
```

## Project Structure

```
frontend/
├── src/
│   ├── components/
│   │   └── UserForm.jsx       # Main form component
│   ├── services/
│   │   └── api.js              # API service functions
│   ├── App.jsx                 # Main app component
│   ├── App.css                 # App styles
│   ├── index.css               # Global styles with Tailwind
│   └── main.jsx                # Entry point
├── public/                     # Static assets
├── amplify.yml                 # AWS Amplify build configuration
├── .env.example                # Environment variables example
├── package.json                # Dependencies and scripts
└── README.md                   # This file
```

## Customization

### Styling

The application uses Tailwind CSS. You can customize:
- Colors in `tailwind.config.js`
- Global styles in `src/index.css`
- Component styles using Tailwind utility classes

### Form Fields

To add or modify form fields, edit `src/components/UserForm.jsx`

## Troubleshooting

### Build Fails on Amplify

- Ensure Node.js version is compatible (check `package.json` engines field)
- Verify `amplify.yml` configuration
- Check build logs in Amplify Console

### API Connection Issues

- Verify `VITE_API_URL` is correctly set
- Check CORS settings on your backend
- Ensure backend is accessible from the frontend domain

## License

MIT
