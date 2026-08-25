/** @type {import('tailwindcss').Config} */
export default {
    content: ['./components/**/*.vue', './layouts/**/*.vue', './pages/**/*.vue'],
    darkMode: 'class', // or 'media' or 'class'
    mode: 'jit',
    variants: {
        extend: {
            backgroundColor: ['group-hover'],
            textColor: ['group-hover']
        }
    },
    theme: {
        extend: {
            writingMode: {
                'vertical-lr': 'vertical-lr'
            },
            boxShadow: {
                'fixed-button': '0 0 5px rgba(0, 0, 0, 0.5)'
            },
            flex: {
                50: '1 1 50%'
            },
            colors: {
                'primary': '#DD2026',
                'secondary': '#343434',
                'gray-light': '#F4F4F4',
                'footer': '#B49B73',
                'icon-yellow': '#FFBB00',
                'gradient-left': '#37538c',
                'gradient-right': '#123681',
                'admin-primary': '#3468d3',
                'admin-content': '#333',
                'black-opacity': 'rgba(0, 0, 0, 0.6)'
            },
            backgroundImage: () => ({
                'gradient-radial': 'radial-gradient(ellipse at center, var(--tw-gradient-stops))',
                'gradient-linear': 'linear-gradient(90deg, var(--tw-gradient-stops))',
                'gradient-conic': 'conic-gradient(var(--tw-gradient-stops))',
                'qa-icon-red': "url('assets/img/qa-icon-red.webp')"
            }),
            fontSize: {
                h1: '2.5rem',
                h2: '2rem',
                h3: '1.75rem',
                h4: '1.5rem',
                h5: '1.25rem',
                h6: '1rem'
            }
        },
        container: {
            center: true,
            padding: '1rem',
            screens: {
                sm: '640px',
                md: '768px',
                lg: '992px',
                xl: '1140px',
                xxl: '1320px'
            }
        },
        screens: {
            sm: '640px',
            md: '768px',
            lg: '992px',
            xl: '1140px',
            xxl: '1320px'
        }
    },
    plugins: []
};

