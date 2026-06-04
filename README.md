# Web Calculator

A responsive web calculator built with a Python backend and a frontend using HTML, Tailwind CSS, JavaScript, and CSS. The app includes an animated interface, interactive background, calculation history, parentheses support, percentage, square root, square, delete, and standard arithmetic operations.

## Features

- Responsive calculator UI
- Tailwind CSS design
- Interactive animated background
- Addition, subtraction, multiplication, and division
- Parentheses expression support
- Percentage, square root, and square functions
- Delete-one-character button
- Calculation history panel
- Local backend API for calculations

## Tech Stack

- Python
- HTML
- Tailwind CSS
- JavaScript
- CSS

## How It Works

The Python backend uses `http.server` to serve the frontend files and handle calculator API requests.

The frontend sends calculation requests to the backend using JavaScript `fetch()`. The backend processes the operation and returns the result as JSON, then the frontend updates the display and history.

## Run Locally

```powershell
python main.py
CALCULATIOR/
├── main.py
└── static/
    ├── index.html
    ├── app.js
    └── styles.css
