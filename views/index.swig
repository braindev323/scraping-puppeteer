<!DOCTYPE html>
<html lang="en">
    <head>
        <meta http-equiv="Content-Type" content="text/html; charset=UTF-8">
        <meta name="viewport" content="width=device-width, initial-scale=1, maximum-scale=1, user-scalable=no">
        <title>Bets</title>
        <meta name="description" content="Bet scraping.">
        <link rel="stylesheet" type="text/css" href="/css/app-base.css" />
    </head>
    <body class="">
        <div>
            <div class="btns-wrapper">
                <button id="surebets-type" class="type-btn btn-primary nav-link">Surebets</button>
                <button id="middles-type" class="type-btn btn-primary nav-link">Middles</button>
                <button id="valuebets-type" class="type-btn btn-primary nav-link">Valuebets</button>
            </div>
            <div id="html">
                
            </div>
        </div>
     </body>
</html>

<style>
    table.app-table .btn-group {
        display: none !important;
    }
    .nav.light-nav {
      display: none !important;
    }
    .alert {
      display: none !important;
    }
    .type-btn {
        height: 48px;
        width: 150px;
        border: none;
        outline: none;
        margin-right: 10px;
        cursor: pointer;
    }
    .btns-wrapper {
        padding: 1rem 1.5rem;
        margin: calc(1.2rem + 1.2rem - 0.5rem - 1.25rem - 1.5rem + 1rem) 0.5rem 0;
        display: flex;
    }
    .nav-link {
        color: gray;
        display: block;
        padding: 0.5rem 1rem;
    }

    .btn-primary {
        background: #30437c linear-gradient(180deg, #4d5d8d, #30437c) repeat-x;
        box-shadow: inset 0 1px 0 rgba(255,255,255,0.15), 0 1px 1px rgba(0,0,0,0.075);
    }
</style>
<script>
    var htmlData = `{{content}}`;
    let nextBtn, prevBtn;

    function htmlDecode(input){
        var e = document.createElement('div');
        e.innerHTML = input;

        let totalString = '';

        if (e.childNodes.length) {
            for (let i = 0; i < e.childNodes.length; i ++) {
                totalString += e.childNodes[i].nodeValue;
            }
        }
        return totalString;
    }

    window.onload = function () {

        let url = window.location.href;

        let surebetsTypeBtn = document.getElementById("surebets-type");
        let middlesTypeBtn = document.getElementById("middles-type");
        let valuebetsTypeBtn = document.getElementById("valuebets-type");

        surebetsTypeBtn.addEventListener('click', function () {
            window.location.href = '/';
        });

        middlesTypeBtn.addEventListener('click', function () {
            window.location.href = '/middles';
        });

        valuebetsTypeBtn.addEventListener('click', function () {
            window.location.href = '/valuebets';
        });

        if (url.includes('middles')) {
            middlesTypeBtn.classList.add('active');
            surebetsTypeBtn.classList.remove('active');
            valuebetsTypeBtn.classList.remove('active');
        } else if (url.includes('valuebets')) {
            middlesTypeBtn.classList.remove('active');
            surebetsTypeBtn.classList.remove('active');
            valuebetsTypeBtn.classList.add('active');
        } else {
            middlesTypeBtn.classList.remove('active');
            surebetsTypeBtn.classList.add('active');
            valuebetsTypeBtn.classList.remove('active');
        }

        document.getElementById("html").insertAdjacentHTML( 'beforeend', htmlDecode(htmlData) );

        nextBtn = document.querySelector('a.next_page');
        prevBtn = document.querySelector('a.previous_page');

        let prevHref, nextHref;

        if (nextBtn) {
            nextHref = nextBtn.href.replace('surebets', '');
        }

        if (prevBtn) {
            prevHref = prevBtn.href.replace('surebets', '');
        }

        aTags = document.getElementsByTagName('a');

        if (aTags.length) {
            for (let i = 0; i < aTags.length; i ++) {
                let tag = aTags[i];
                if (!tag.href.includes('group?like=') || !tag.href.includes('item=')) {
                    if (tag.href.includes('group?like=') && !tag.href.includes('item=')) {
                        tag.style.display = 'none';
                    }

                    tag.href = "#";
                    tag.target = "_self";
                }
            }
        }

        if (nextBtn) {
            nextBtn.href = nextHref;
        }

        if (prevBtn) {
            prevBtn.href = prevHref;
        }
    }
    
    function onNext () {
        console.log('next btn');
        return false;
    }

    function onPrev () {
        console.log('prev btn');
        return false;
    }
</script>
