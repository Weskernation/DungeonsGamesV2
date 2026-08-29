// Online-widget automatisch aanmaken
const onlineWidget = document.createElement('div');
onlineWidget.id = 'online-widget';

onlineWidget.innerHTML = `
    <div id="online-header">
        🟢 Online: <span id="online-count">0</span>
    </div>

    <div id="online-list"></div>
`;

document.body.appendChild(onlineWidget);


// Socket.IO
const socket = io({
    transports: ['websocket']
});

socket.on('connect', () => {
    console.log(
        'Socket.IO verbonden:',
        socket.id
    );
});

socket.on('disconnect', (reason) => {
    console.log(
        'Socket.IO verbinding verbroken:',
        reason
    );
});

socket.on('connect_error', (error) => {
    console.error(
        'Socket.IO connect_error:',
        error.message
    );
});

const userData = document.body.dataset.user;


if (userData) {

    // =========================
    // Discord-gebruiker
    // =========================

    const user = JSON.parse(userData);

    const logoutButton = document.createElement('a');

    logoutButton.id = 'logout-button';
    logoutButton.href = '/logout';
    logoutButton.textContent = 'Uitloggen';

    onlineWidget.appendChild(logoutButton);


    socket.on('onlineUsers', (data) => {

        console.log("Ontvangen online data:", data);


        const count = document.getElementById('online-count');
        const list = document.getElementById('online-list');


        if (!count || !list) {
            return;
        }


        const users = data.users || [];
        const guestCount = data.guestCount || 0;


        // Totaal aantal online bezoekers
        count.textContent = users.length + guestCount;


        list.innerHTML = "";


        // Discord-gebruikers
        users.forEach(user => {

            const item = document.createElement('p');

            item.innerHTML =
                user.global_name +
                "<br>" +
                "<small>@" + user.username + "</small>";

            list.appendChild(item);

        });


        // Anonieme bezoekers
        if (guestCount > 0) {

            const item = document.createElement('p');

            item.textContent = `Anoniem (${guestCount})`;

            list.appendChild(item);

        }

    });


    socket.emit('registerUser', user);


    // ---------------------------------
    // Online-widget bediening
    // Alleen voor ingelogde gebruikers
    // ---------------------------------

    const onlineHeader =
        document.getElementById('online-header');

    if (onlineHeader) {

        onlineHeader.addEventListener('click', () => {

            onlineWidget.classList.toggle('open');

        });

    }


} else {

    // =========================
    // Anonieme bezoeker
    // =========================

    // ---------------------------------
    // Inlogknop
    // ---------------------------------

    const loginButton = document.createElement('a');

    loginButton.id = 'logout-button';

    loginButton.href = '/auth/discord';

    loginButton.textContent = 'Inloggen met Discord';

    onlineWidget.appendChild(loginButton);


    // ---------------------------------
    // Online aantal
    // ---------------------------------

    socket.on('onlineUsers', (data) => {

        console.log(
            "Ontvangen online data voor gast:",
            data
        );


        const count =
            document.getElementById('online-count');

        const list =
            document.getElementById('online-list');


        if (!count || !list) {
            return;
        }


        const users = data.users || [];
        const guestCount = data.guestCount || 0;


        // Totaal aantal online bezoekers
        count.textContent =
            users.length + guestCount;


        // ---------------------------------
        // Voor anonieme bezoekers:
        // GEEN namen en GEEN Anoniem (X)
        // ---------------------------------

        list.innerHTML = "";

    });


    // ---------------------------------
    // Registreren als anonieme bezoeker
    // ---------------------------------

    socket.emit('registerGuest');

}