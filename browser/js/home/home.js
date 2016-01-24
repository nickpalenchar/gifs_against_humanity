app.config(function ($stateProvider) {
    $stateProvider.state('home', {
        url: '/play',
        templateUrl: 'js/home/home.html',
        controller: 'QuestionController',
        params: {
            allPlayers: null,
            me: null,
            deckId: null
        },
        resolve: {
            deck: function ($stateParams, GifFactory) {
                console.log("[resolve] starting..", $stateParams);
                return GifFactory.getConstructedDeck($stateParams.deckId);
            }
        }
    });
});

app.controller('QuestionController', function ($scope, $window, Socket, UserFactory,
                                               GifFactory, QuestionFactory, $state, deck) {
    //phases = 'initialization', ['question', 'selection', 'cleanup'] <-- circular

    //Use this to hide dev buttons and info -- when testing/presenting
    $scope._developer = false;
    // console.log("backend deck:", deck);
    Socket.on('connect', function () {
        console.log("I HAVE CONNECTED");
    });
    //for player profile directive
    $scope.localId = $state.params.me._id;
    $scope.phase = 'initialization';
    // INITIALIZATION
    $scope.questionDeck = deck.questions;
    $scope.gifDeck = deck.gifs;
    $scope.allPlayers = $state.params.allPlayers;
    $scope.gameDecksId = $state.params.deckId;
    $scope._changedDealer = false;

    var numReadyForNextRound = 0;

    //QUESTION PHASE
    //Chosen GIFs
    $scope.myPick = null;
    $scope.showPicks = false;
    $scope.pickedCards = [];
    $scope.revealReady = false;
    $scope.chosenGifs = 0;

    // initialize players
    $scope.allPlayers.forEach(function (user) {
        user.currentStatus = "PLAYER"
    });
    // initialize dealer
    $scope.dealerIndex = 0;
    $scope.allPlayers[$scope.dealerIndex].currentStatus = "DEALER";
    //get index of primary player
    for (var i = 0; i < $scope.allPlayers.length; i++) {
        if ($scope.allPlayers[i]._id === $state.params.me._id) {
            $scope.primaryPlayerIndex = i;
            break;
        }
    }
    $scope.getLocalPlayer = function () {
        return $scope.allPlayers[$scope.primaryPlayerIndex];
    };
    //initialize game function
    $scope.newQuestion = function () {
        deck.questions.shift();
        Socket.emit('newQuestion', deck.questions)
    };

    // sets primary player
    // this will soon be depricated
    $scope.primaryPlayer = $scope.allPlayers[$scope.primaryPlayerIndex];
    //$scope.isDealer() = $scope.primaryPlayer.currentStatus === "DEALER";
    $scope.isDealer = function () {
        return $scope.primaryPlayerIndex === $scope.dealerIndex;
    };

    //deal to all players
    $scope.dealToPlayer = function (n, cards, shouldUpdate) {
        var theHand = $scope.allPlayers[n].hand;
        while (cards > 0) {
            theHand.push(deck.gifs.shift());
            cards--
        }
        Socket.emit('updateGifDeck', deck.gifs);
        console.log("a new hand", $scope.getLocalPlayer().hand);
        //singular update of all hands (at the last loop call from cleanup phase
        if (shouldUpdate) {
            console.log("UPDATING PLAYER STATS: ", $scope.allPlayers);
            Socket.emit('updateOnePlayerStats', $scope.allPlayers, $scope.primaryPlayerIndex);
        }
    };
    Socket.on('updateOnePlayerStats', function (stats, ind) {
        console.log("updateOnePlayerStats socket: updating...", $scope.allPlayers[idn], stats[idn]);
        $scope.allPlayers[ind] = stats[ind];
        console.log("new player info", $scope.allPlayers);
    });
    Socket.on('updateGifDeck', function (newDeck) {
        deck.gif = newDeck;
    });
    $scope.allPlayers.forEach(function (p, i) {
        $scope.dealToPlayer(i, 8);
    });
    console.log("GIF DECK ", deck.gifs);

    //QUESTION PHASE
    $scope.phase = 'question';
    Socket.on('changeQuestion', function (questionDeck) {
        deck.questions = questionDeck;
        $scope.questionDeck = deck.questions;
        $scope.$digest()
    });

    Socket.on('doCleanupPhase', function(){
        $scope.allPlayers.forEach(function(p, i){
            $scope.dealToPlayer(i, (8 - p.hand.length));
        });
        console.log("END OF DEAL NEW CARDS", $scope.allPlayers);
        $scope.newDealer();
        $scope.newQuestion();
        $scope.pickedCards = [];
        $scope.myPick = null;
        $scope.showPicks = false;
        $scope.revealReady
        $scope.phase = 'question';
        $scope.$digest();
    });

    $scope.revealPicks = function () {
        Socket.emit('revealPicks')
    };

    Socket.on('revealPicks', function () {
        $scope.pickedCards = _.shuffle($scope.pickedCards);
        $scope.showPicks = true;
        $scope.$digest()
    });
    //GAME PLAY HELPER FUNCTIONs

    Socket.on('up');

    //when player chooses a card during question phase
    $scope.chooseGif = function (card) {
        console.log("myPick", $scope.myPick);
        console.log("dealer", $scope.isDealer());

        if (!$scope.myPick && !$scope.isDealer() && $scope.phase === 'question') {
            console.log("choosing!!!", card);
            $scope.myPick = card;
            _.remove($scope.allPlayers[$scope.primaryPlayerIndex].hand, {imageUrl: card.imageUrl});
            console.log("new gif deck", $scope.allPlayers[$scope.primaryPlayerIndex].hand);
            Socket.emit('chooseGif', card)
        }
    };
    Socket.on('updatePlayerStats', function (stats) {
        $scope.allPlayers[$scope.primaryPlayerIndex] = stats[$scope.primaryPlayerIndex];
    })
    Socket.on('chooseGif', function (card) {
        //$scope.chosenGifs++
        $scope.pickedCards.push(card);
        console.log("picked cards new", $scope.pickedCards);
        // console.log("chosenGifs", $scope.chosenGifs)
        if ($scope.pickedCards.length === $scope.allPlayers.length - 1) {
            Socket.emit('revealReady')
        }
        $scope.$digest();
    });
    Socket.on('revealReady', function () {
        $scope.revealReady = true;
        $scope.phase = 'selection';
        $scope.$digest();
        Socket.emit('updateOnePlayerStats', $scope.allPlayers, $scope.primaryPlayerIndex);
    });

    //SELECTION PHASE
    //here the dealer is able to click on a card he/she likes and it is recorded for
    //point awards in cleanup.
    $scope.dealerSelection = function (card) {
        console.log("dealer selection invoked, showPics", $scope.showPicks);
        if ($scope.phase === 'selection' && $scope.showPicks) {
            alert("You selected a card!");
            $scope.phase = 'cleanup';
            Socket.emit('doCleanupPhase')
            //$scope.toQuestionPhase();
        }
        //TODO: point system goes here.

    }

    //CLEANUP PHASE
    //Socket.on('toCleanupPhase', $scope.t)
    //clear selected gif cards
    //point to selected card
    //all sans dealer new card
    $scope.toQuestionPhase = function () {
        Socket.emit('toQuestionPhase');
        //wait for all players to be ready
    };
    Socket.on('toQuestionPhase', function () {
        if ($scope.isDealer()) {
            $scope.allPlayers.forEach((player, i, a) => {
                if ($scope.dealerIndex !== i) $scope.dealToPlayer(i, 1, (i === a.length - 1));
            });
            Socket.emit('readyForNextRound');
        }
    });


    $scope.newDealer = function () {
        console.log("new dealer recieved. old dealer", $scope.allPlayers[$scope.dealerIndex]);
        //BEGINS TEST
        $scope.allPlayers[$scope.dealerIndex].currentStatus = "PLAYER";
        $scope.dealerIndex = $scope.dealerIndex < $scope.allPlayers.length - 1 ? $scope.dealerIndex + 1 : 0;
        $scope.allPlayers[$scope.dealerIndex].currentStatus = "DEALER";
        //END TEST
        //Socket.emit('newDealer');
    };
    Socket.on('newDealer', function () {
        //change scope.phase to selection instaed of _changeDealer
        if (!$scope.phase === 'cleanup') {
            console.log("new dealer recieved. old dealer", $scope.allPlayers[$scope.dealerIndex]);
            $scope.allPlayers[$scope.dealerIndex].currentStatus = "PLAYER";
            $scope.dealerIndex = $scope.dealerIndex < $scope.allPlayers.length - 1 ? $scope.dealerIndex + 1 : 0;
            $scope.allPlayers[$scope.dealerIndex].currentStatus = "DEALER";
            $scope._changedDealer = true;
            $scope.$digest();
            console.log("new dealer", $scope.allPlayers[$scope.dealerIndex]);
            $scope.phase = 'question'
        }

    });

    $scope.gamePhase = 0;

});
