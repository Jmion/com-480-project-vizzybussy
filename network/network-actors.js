;(function () {
  // We use a IIFE wrapping to hide the code from adversary
  // Setup config variables and start the program
  function init () {
    graphCanvas = d3.select('#graphDiv').append('canvas')
                   .attr('id', 'main-canvas')
                   .attr('width', graphWidth + 'px')
                   .attr('height', height + 'px')
                   .on('mousemove', highlightPicking)
                   .node();
    context = graphCanvas.getContext('2d');
    // ref: https://books.google.fr/books?id=lkBPDwAAQBAJ&pg=PA173&lpg=PA173&dq=interact+with+d3+canvas&source=bl&ots=boP_YKjew2&sig=ACfU3U0v5wYUQM3zJutsMpvv1ADE7XFvIA&hl=fr&sa=X&ved=2ahUKEwjri6-ai_zoAhXC3YUKHcZKA0M4ChDoATAFegQIChAB#v=onepage&q=interact%20with%20d3%20canvas&f=false
    hiddenCanvas = d3.select('#graphDiv').append('canvas')
                       .attr('id', 'canvas-hidden')
                       .attr('width', graphWidth + 'px')
                       .attr('height', height + 'px')
                       .node();
    hiddenContext = hiddenCanvas.getContext('2d');
    document.getElementById("canvas-hidden").style.visibility = "hidden";


    num_movies = document.getElementById("num-movies").value;
    datapath = `data/dataset_${num_movies}_common_movies.json`;
    build_network(datapath);
    d3.select("#num-movies").on("change", changeDataset);

  }

  var num_movies;
  var transform = d3.zoomIdentity;
  var radius = 3;
  var margin = 10
  var selected = false;
  var defaultNodeCol = "white",
      highlightCol = "yellow";
  var tempData;
  var elem;
  var height;
  var graphWidth;

  var actor_selected = false,
      actor_selected_name = "";

  updateBB();
  function updateBB(){
    elem = document.getElementById("graphDiv");
    if (elem) {
       var rect = elem.getBoundingClientRect();
       height = rect.height;
       graphWidth = rect.width;
       console.log(rect.height);
    }
  }

  var zoom = d3.zoom()
               .scaleExtent([1 / 10, 8])
               .on("zoom", zoomed);




  var graphCanvas,
      hiddenCanvas,
      hiddenContext,
      context;

  // Wait for the HTML to load
  document.addEventListener('DOMContentLoaded', init);

  function changeDataset() {
    /** Change dataset to generate the network amongst the dataset available [1-10]. */
    datapath = `data/dataset_${d3.select(this).property('value')}_common_movies.json`;
    // Get canvas
    var simulation = createSimulation(graphWidth, height);
    // Save current canvas transform
    context.save();
    hiddenContext.save();
    // Use the identity matrix while clearing the canvas
    context.setTransform(1, 0, 0, 1, 0, 0);
    hiddenContext.setTransform(1, 0, 0, 1, 0, 0);
    context.clearRect(0, 0, graphCanvas.width, graphCanvas.height);
    hiddenContext.clearRect(0, 0, graphCanvas.width, graphCanvas.height);
    // Restore the transform
    context.restore();
    hiddenContext.restore();
    hideTooltip();
    keepOpacity = [];
    overnode = false;
    current_node_name = "";
    simulationUpdate();
    min_x = graphWidth; min_y = height; max_x = 0; max_y = 0;
    // Build new network
    build_network(datapath);
  };

  function createSimulation(width, height){
    /** Create simulation object. */
    var simulation = d3.forceSimulation()
    .force("link", d3.forceLink().id(function(d) { return d.id; }))
    .force("charge", d3.forceManyBody())
    .force('x', d3.forceX(width / 2).strength(0.02))
    .force('y',  d3.forceY(height / 2).strength(0.02));
    return simulation;
  };


  var keepOpacity = [];
  var overnode = false;
  var current_node_name;

  function highlightPicking() {
    var pos = d3.mouse(this); // get the mouse pixel positions
    var pickedColor = hiddenContext.getImageData(pos[0], pos[1], 1, 1).data; // get the pixel color at mouseover
    selected = pickedColor[3] == 255 ? [pickedColor[0], pickedColor[1], pickedColor[2]]  : false; // checking for antialiasing
    if (selected != false) {
      var object = getObjectByColor(selected);
      var selected_object = object[0];
      var is_edge = object[1];
      if (is_edge) {
        var link = selected_object[0];
        movie_ids = link.movie_id;
        showTooltip(pos, getMovieInfos(movie_ids));
      } else {
        var node = selected_object[0];
        if (!actor_selected) {
          keepOpacity = node2neighbors[node.id];
          overnode = true;
          current_node_name = node.id;
        }

        simulationUpdate();
      }
    } else {
      hideTooltip();
      if (!actor_selected) keepOpacity = [];
      overnode = false;
      current_node_name = "";
      simulationUpdate();
    }

  }

  function num2rgb(n){
    /** Map an integer to a rgb value.
    /* ref: https://math.stackexchange.com/questions/1635999/algorithm-to-convert-integer-to-3-variables-rgb */

    var b = n % 256,
        g = ((n-b)/256)%256,
        r = ((n-b)/Math.pow(256, 2)) - g/256;
    return 'rgb('+r+','+g+','+b+')'
  }

  function getObjectByColor(color) {
    /** Return object with the given color */
    rgb_str = 'rgb('+color[0]+','+color[1]+','+color[2]+')'
    var links_search = tempData.links.filter(
      function(d){ return d.color == rgb_str }
    );
    var nodes_search = tempData.nodes.filter(
      function(d){ return d.color == rgb_str }
    );
    var result = (links_search.length == 0) ? [nodes_search, false]:[links_search, true]
    return result
  }

  function getMovieInfos(list_movies) {
    /** Return the list of movies with the given ids. */
    return tempData.movies_info.filter(
      function(d){
        return list_movies.includes(d.movie_id)}
    );
  }

  var movieQueue = [undefined, undefined]; // initialise queue array to check for new build

  function parseDate(date) {
    var numbers = date.split("-")
    var year,
        month,
        day;
    year = numbers[0]
    day = numbers[2]
    switch(parseInt(numbers[1])){
        case 1: month = "January";
            break;
        case 2: month = "February";
            break;
        case 3: month = "March";
            break;
        case 4: month = "April";
            break;
        case 5: month = "May";
            break;
        case 6: month = "June";
            break;
        case 7: month = "July";
            break;
        case 8: month = "August";
            break;
        case 9: month = "September";
            break;
        case 10: month = "October";
            break;
        case 11: month = "November";
            break;
        case 12: month = "December";
            break;
        }
    return day + " " + month + " " + year;
  }

  function drawTooltip(image_url, title, genres, release_date, link) {
    d3.select('#tooltip')
      .append('div')
      .attr("class", "")
      .html("<div class='panel'>" +
        "<img class='resize' src='"+image_url+"'>" +
        '<p class="title">'+title+'</p>' +
          "Genres: " + genres.toString().replace(/,/g, ", ") +
            "<br> Release date: " + parseDate(release_date) +
            "<br> " +
            "<br> More info: " + parseDate(release_date) +
            "<br> " +
          "</div>")
  }



  function movieToHtml(movie_info) {
    var title = movie_info.title
    theMovieDb.movies.getById(
        {"id":movie_info.movie_id},
        (d) => {
            var posterPath = JSON.parse(d).poster_path;
            if(posterPath!=null){
                var image_url = "https://image.tmdb.org/t/p/w500" + JSON.parse(d).poster_path
                console.log(d)
            }else{
                var image_url = "https://as1.ftcdn.net/jpg/02/23/81/56/500_F_223815602_idMOSbp7Z3eN25V2mslRioWS68V3LNZt.jpg"
            }
            drawTooltip(image_url, title, movie_info.genres, movie_info.release_date)
        },
        (d) => {
            console.log(d)})
  }

  function actorToHtml(actor) {
    
  }


  function showTooltip(mouse, movies_info, actor = false) {
    if (!actor) {
      /** Show a tooltip when mouseover a edge. */
      // Create queue to check when to build new tooltip
      movieQueue.unshift(movies_info);
      movieQueue.pop();

      // Build and move tooltip accordingly
      if (movieQueue[0] != movieQueue[1]) {

        // Build tooltip
        d3.select("#tooltip").html("")
        _.sortBy(movies_info, (d) => d['movie_id']).forEach(movieToHtml);

        // Show and move tooltip
        d3.select('#tooltip')
          .style('left', (mouse[0] + 20) + 'px')
          .style('top', (mouse[1] + 20) + 'px')
          .transition().duration(100)
          .style('opacity', 0.98);

      } else {

        // Move tooltip
        d3.select('#tooltip')
          .style('left', (mouse[0] + 20) + 'px')
          .style('top', (mouse[1] + 20) + 'px');

      } // check when new tooltip need to be build and moved vs when tooltip just needs to be moved
    } else {
      // Build tooltip
      d3.select("#tooltip").html("")
      _.sortBy(movies_info, (d) => d['movie_id']).forEach(movieToHtml);

      // Show and move tooltip
      d3.select('#tooltip')
        .style('left', (mouse[0] + 20) + 'px')
        .style('top', (mouse[1] + 20) + 'px')
        .transition().duration(100)
        .style('opacity', 0.98);
    }

  } // showTooltip()

  function hideTooltip() {
    /** Hide the tooltip. */
    movieQueue.unshift(undefined);
    movieQueue.pop();
    /*
    d3.select('#tooltip')
      .transition().duration(500)
      .delay(300)
      .style('opacity', 0.5);
    */
  } // hideTooltip()



  function zoomed() {
    transform = d3.event.transform;
    simulationUpdate();
  }

  function update_bb(d) {
    var dx = parseInt(d.x),
        dy = parseInt(d.y);
    if (dx > max_x) {
      max_x = dx + 10;
    }
    if (dx < min_x) {
      min_x = dx - 10;
    }
    if (dy > max_y) {
      max_y = dy + 10;
    }
    if (dy < min_y) {
      min_y = dy - 10;
    }

  }


  function simulationUpdate(){
    /** Update the force simulation. */
    context.save();
    hiddenContext.save();

    context.clearRect(0, 0, graphWidth, height);
    context.translate(transform.x, transform.y);
    context.scale(transform.k, transform.k);

    hiddenContext.clearRect(0, 0, graphWidth, height);
    hiddenContext.translate(transform.x, transform.y);
    hiddenContext.scale(transform.k, transform.k);
    tempData.links.forEach(function(d) {
          context.beginPath();
          context.moveTo(d.source.x, d.source.y);
          context.lineTo(d.target.x, d.target.y);
          context.strokeStyle = "grey";
          if ((actor_selected || overnode) && current_node_name != d.source.id && current_node_name != d.target.id && actor_selected_name != d.source.id && actor_selected_name != d.target.id ) {
            context.globalAlpha = 0.1;
          } else {
            context.globalAlpha = 1;
            if (actor_selected || overnode) {
              context.globalAlpha = 0.8;
            }
          }
          context.stroke();

          // Replicate on the hidden canvas
          hiddenContext.beginPath();
          hiddenContext.moveTo(d.source.x, d.source.y);
          hiddenContext.lineTo(d.target.x, d.target.y);
          hiddenContext.strokeStyle = d.color;
          context.globalAlpha = 1;
          hiddenContext.stroke();
      });
    // Draw the nodes
    var printText = false;
    var margin = 10


    tempData.nodes.forEach(function(d) {
        context.beginPath();
        context.arc(d.x, d.y, radius, 0, 2 * Math.PI, true);
        context.fillStyle = d.gender == 2 ? "blue": (d.gender == 1 ? "red":"black" );
        if ((actor_selected || overnode) && current_node_name != d.id && actor_selected_name != d.id && !keepOpacity.includes(d.id)) {
          context.globalAlpha = 0.1;
        } else {
          context.globalAlpha = 1;
          if (actor_selected || overnode) {
            printText = true;
          }
          if (current_node_name == d.id || actor_selected_name == d.id) {
            context.arc(d.x, d.y, radius*1.3, 0, 2 * Math.PI, true);
          }
        }
        context.fill();
        if (printText) {
          context.beginPath();
          context.font = '4pt Calibri';
          context.fillStyle = d.gender == 2 ? "blue": (d.gender == 1 ? "red":"black" );
          context.textAlign = 'center';
          context.fillText(d.id, d.x, d.y-5);
          printText = false;
        }
        // Replicate on the hidden canvas
        hiddenContext.beginPath();
        hiddenContext.arc(d.x, d.y, radius, 0, 2 * Math.PI, true);
        hiddenContext.fillStyle = d.color;
        context.globalAlpha = 1;
        hiddenContext.fill();
    });
    context.restore();
    hiddenContext.restore();

  }

  // Set up dictionary of neighbors
  var node2neighbors;

  function build_network(datapath){
    /** Build network with drag, zoom functionalities. */
    var simulation = createSimulation(graphWidth, height);
    hideTooltip();
    node2neighbors = {};
    d3.json(datapath, function(error, data){
        if (error) throw error;
        // Map each link and node to a unique color
        data.links.forEach(function(d,i){
          d.color = num2rgb(i);
        });
        offset_nodes = data.links.length
        data.nodes.forEach(function(d,i){
          d.color = num2rgb(offset_nodes + i)
          theMovieDb.people.getById({"id":parseInt(d.person_id)}, (person) => {
            var person_dict = JSON.parse(person);
            console.log(person_dict)
            if (parseInt(d['gender']) == 0) {
              d['gender'] = person_dict['gender'];
            }
            d.imdb_id = person_dict['imdb_id'];
            d.birthday = person_dict['birthday'];
            if (person_dict['deathday'] != null) {
              d.deathday = person_dict['deathday'];
            }
            if (person_dict['profile_path'] != null) {
              d.profile_path = person_dict['profile_path']
            }
          }, (person) => console.log(person))
        });

        // Get the neighbors of each nodes
        data.nodes.forEach(function(node){
          var name = node.id;
          node2neighbors[name] = data.links.filter(function(d){
                  return d.source == name || d.target == name;
              }).map(function(d){
                  return d.source == name ? d.target : d.source;
              });
        });


        initGraph(data)

        function initGraph(data){
          tempData = data;



          function autocomplete($ctl, data, cb, freeInput) {
            // Ref: http://jsfiddle.net/jlowery2663/o4n29wn3/
            $ctl.autocomplete({
              minLength: 0,
              autoFocus: false,
              messages: {
                  noResults: '',
                  results: function () {}
              },
              source: data,
              select: function (e, ui) {
                  // console.log("ui.item", ui.item)
                  cb(e, ui)

              },
              change: function (e, ui) {
                  if (!(freeInput || ui.item)) {
                    e.target.value = "";
                    actor_selected = false;
                    actor_selected_name = "";
                    keepOpacity = [];
                    console.log("No actor selected: ", actor_selected, actor_selected_name);
                    simulationUpdate()
                  }
              }
            });
          };

          autocomplete($('#actor'), tempData.nodes.map(n => n.id), function (e, ui) {
            actor_selected = true;
            actor_selected_name = ui.item.value;
            keepOpacity = node2neighbors[actor_selected_name];
            console.log("Actor selected: ", actor_selected, actor_selected_name)
            simulationUpdate()
          });




          d3.select(graphCanvas)
              .call(d3.drag()
                      .subject(dragsubject)
                      .on("start", dragstarted)
                      .on("drag", dragged)
                      .on("end",dragended))
              .call(zoom);

        function dragsubject() {
          var i,
              x = transform.invertX(d3.event.x),
              y = transform.invertY(d3.event.y),
              dx,
              dy;
          for (i = tempData.nodes.length - 1; i >= 0; --i) {
            node = tempData.nodes[i];
            dx = x - node.x;
            dy = y - node.y;

            if (dx * dx + dy * dy < radius * radius) {

              node.x =  transform.applyX(node.x);
              node.y = transform.applyY(node.y);


              return node;
            }
          }

        }


        function dragstarted() {
          if (!d3.event.active) simulation.alphaTarget(0.3).restart();
          d3.event.subject.fx = transform.invertX(d3.event.x);
          d3.event.subject.fy = transform.invertY(d3.event.y);
          }

        function dragged() {
          d3.event.subject.fx = transform.invertX(d3.event.x);
          d3.event.subject.fy = transform.invertY(d3.event.y);

        }

        function dragended() {
          if (!d3.event.active) simulation.alphaTarget(0);
          d3.event.subject.fx = null;
          d3.event.subject.fy = null;
        }

          simulation.nodes(tempData.nodes)
                    .on("tick",simulationUpdate);

          simulation.force("link")
                    .links(tempData.links);

          simulationUpdate();

        }
      })
    }})();
