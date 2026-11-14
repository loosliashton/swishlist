import { initializeApp } from 'firebase/app';

export const environment = {
  production: false,
};

// Your web app's Firebase configuration
const firebaseConfig = {
  apiKey: 'AIzaSyDxZIKtuQ3gFXnAjWSVnmgh51pPxmSPjmA',
  authDomain: 'swishlist.cc',
  projectId: 'christmas-list-4b180',
  storageBucket: 'christmas-list-4b180.appspot.com',
  messagingSenderId: '1064787530858',
  appId: '1:1064787530858:web:27f5f984d09486586d6613',
};

// Initialize Firebase
export const app = initializeApp(firebaseConfig);
