export default {
    content: ['./index.html', './src/**/*.{js,jsx}'],
    theme: {
        extend: {
            boxShadow: {
                soft: '0 20px 50px rgba(15, 23, 42, 0.12)',
            },
            backgroundImage: {
                hero: 'radial-gradient(circle at top left, rgba(236, 72, 153, 0.18), transparent 32%), radial-gradient(circle at bottom right, rgba(59, 130, 246, 0.18), transparent 28%)',
            },
        },
    },
    plugins: [],
}
