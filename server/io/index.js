'use strict';
var socketio = require('socket.io');
var _ = require('lodash');
var io = null;

module.exports = function (server) {

    if (io) return io;

    io = socketio(server);

    var players = [];

    io.on('connection', function (socket) {
        console.log("NEW USER", socket.id);

        socket.on('disconnect', function(){
            var _idToRemove = (_.find(players, {'socketId': socket.id})||{})._id;
            // each page should have it's own reciever of this event.
            io.emit('removePlayer', _idToRemove);
        });

        socket.on('newPlayer', function (allPlayers, userCount, userId) {
            players.push({_id: userId, socketId: socket.id});
            io.emit('newPlayer', allPlayers, userCount, socket.id);
        });

        socket.on('joinRoom', function (deckId) {
            io.emit('gameStart', deckId, socket.id);
        });

        socket.on('newQuestion', function (questionDeck) {
            io.emit('changeQuestion', questionDeck);
        });

        socket.on('chooseGif', function (card) {
            io.emit('chooseGif', card);
        });

        socket.on('revealPicks', function () {
            io.emit('revealPicks');
        });

        socket.on('updateGifDeck', function (deck) {
            io.emit('updateGifDeck')
        });


        socket.on('cleanupPhase', function () {
            io.emit('cleanupPhase');
        });

        socket.on('revealReady', function () {
            io.emit('revealReady');
        });

        socket.on('doCleanupPhase', function (card) {
            io.emit('doCleanupPhase', card);
        });

        socket.on('newDealer', function () {
            io.emit('newDealer');
        });

        socket.on('toQuestionPhase', function () {
            io.emit('toQuestionPhase');
        });
        socket.on('updateOnePlayerStats', function (stats, ind) {
            io.emit('updateOnePlayerStats', stats, ind);
        });

        socket.on('winningCard', function (card) {
            //Depricted: This is merged with `doCleanupPhase`
            io.emit('winningCard', card);
        });

        socket.on('newConnection', function () {
            io.emit('newConnection');
        });
        socket.on('readyForUsername', function () {
            io.emit('readyForUsername');
        });
        socket.on('killGame', function() {
            //TODO kill the game
        });
    });

    return io;

};
