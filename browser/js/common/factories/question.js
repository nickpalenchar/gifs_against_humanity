app.factory('QuestionFactory', function($http){
    return {
        fetchAll: function() {
            return $http.get('/api/qcards')
            .then(response => response.data);
        },
        constructQuestionDeck: function() {
            return $http.get('api/qcards/shuffle')
                .then(function(cards){
                    return cards.data;
                });
        }
    }
});