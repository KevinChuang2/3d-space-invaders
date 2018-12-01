window.Space_Invaders_Scene = window.classes.Space_Invaders_Scene =
class Space_Invaders_Scene extends Scene_Component
  { constructor( context, control_box )     // The scene begins by requesting the camera, shapes, and materials it will need.
      { super(   context, control_box );    // First, include a secondary Scene that provides movement controls:
        //if( !context.globals.has_controls   ) 
          //context.register_scene_component( new Movement_Controls( context, control_box.parentElement.insertCell() ) ); 

        context.globals.graphics_state.camera_transform = Mat4.look_at( Vec.of( 0,4,10 ), Vec.of( 0,0,0 ), Vec.of( 0,1,0 ) );

        const r = context.width/context.height;
        context.globals.graphics_state.projection_transform = Mat4.perspective( Math.PI/4, r, .1, 1000 );

        // TODO:  Create two cubes, including one with the default texture coordinates (from 0 to 1), and one with the modified
        //        texture coordinates as required for cube #2.  You can either do this by modifying the cube code or by modifying
        //        a cube instance's texture_coords after it is already created.
        const shapes = { box:   new Cube(),
                         box_2: new Cube(),
                         axis:  new Axis_Arrows(),
                         laser: new Rounded_Capped_Cylinder(10,10),
                         invader1: new Shape_From_File( "/assets/models/invader1.obj" ),
                         invader2: new Shape_From_File( "/assets/models/invader2.obj" ),
                         invader3: new Shape_From_File( "/assets/models/invader3.obj" ),
                         invader4: new Shape_From_File( "/assets/models/invader4.obj" ),
                         player: new Shape_From_File( "/assets/models/player.obj" ),
                         player_base: new Shape_From_File( "/assets/models/player_base.obj" ),
                         player_turret: new Shape_From_File( "/assets/models/player_turret.obj" ),
                         ground: new Shape_From_File( "/assets/models/ground.obj")
                       }
        this.submit_shapes( context, shapes );

        // TODO:  Create the materials required to texture both cubes with the correct images and settings.
        //        Make each Material from the correct shader.  Phong_Shader will work initially, but when 
        //        you get to requirements 6 and 7 you will need different ones.
        this.materials =
          { 
            invader1: context.get_instance( Phong_Shader ).material( Color.of( 1,.855,.078,1 ), { ambient:0.4} ), //make intermediate models
            invader2: context.get_instance( Phong_Shader ).material( Color.of( .224,1,.078,1 ), { ambient:0.4} ),
            invader3: context.get_instance( Phong_Shader ).material( Color.of( 1,.078,.686,1 ), { ambient:0.4} ),
            invader4: context.get_instance( Phong_Shader ).material( Color.of( .078,1,.855,1 ), { ambient:0.4} ),
            ground: context.get_instance( Phong_Shader ).material( Color.of( 0.40, 0.26, 0.13, 1 ), { ambient:0.2, specularity:0} ),
            player_base: context.get_instance( Phong_Shader ).material( Color.of( 0.80, 0.80, 0.80, 1 ) ),
            player_turret: context.get_instance( Phong_Shader ).material( Color.of( 0.70, 0.70, 0.70, 0.9 ) ),
            laser: context.get_instance( Phong_Shader ).material( Color.of( 1, 0, 0, 1 ), { ambient:1, 
                                                                                            specularity:0,
                                                                                            diffusivity:0 })
          }

        this.lights = [ new Light( Vec.of( -5,15,5,1 ), Color.of( 0,1,1,1 ), 100000 ) ];

        // TODO:  Create any variables that needs to be remembered from frame to frame, such as for incremental movements over time.
        this.enemy_pos = [ ];
        this.laser_pos = [ ];
        this.camera_angle = 0;
        this.target_angle = 0;
        //how many seconds in between each spawn 
        this.spawnRate = 2.0;
        this.spawnTime = 0;
        //angle in which we spawn new enemy 
        this.spawnAngle = 0;
        this.score = 0;
        this.maxSpawn = 15;

        this.spawnDistance = 20;
        this.spawnHeight = 10;
        this.fallRate = .025;
        this.enemySpeed = 0.02;

        this.gameOver = false;
        this.sound = {};
        this.init_sounds();
        

        

      }
    make_control_panel()
      { // TODO:  Implement requirement #5 using a key_triggered_button that responds to the 'c' key.
        this.key_triggered_button( "Rotate Left",  [ "a" ], () => this.target_angle += 0.1 );
        this.key_triggered_button( "Rotate Right",  [ "d" ], () => this.target_angle -= 0.1 );
        this.key_triggered_button( "Shoot Laser",  [ "v" ], () => this.shoot_laser() );
        this.key_triggered_button( "Restart (when dead)", ["p"], () => this.restart_game());
      }
    display( graphics_state )
      { graphics_state.lights = this.lights;        // Use the lights stored in this.lights.
        const t = graphics_state.animation_time / 1000, dt = graphics_state.animation_delta_time / 1000;

        // TODO:  Draw the required boxes. Also update their stored matrices.
        this.smooth_camera();
        //player

        let model_transform = Mat4.identity().times( Mat4.translation( [0, 2, 0] ) );
        this.shapes.player_base.draw( graphics_state, model_transform, this.materials.player_base );
        model_transform = model_transform.times( Mat4.translation( [0, 1.2, 0] ) )
                                              .times( Mat4.scale( [0.55,0.55,0.55] ) )
                                              .times( Mat4.rotation( this.camera_angle, Vec.of(0,1,0) ) );
        this.shapes.player_turret.draw( graphics_state, model_transform, this.materials.player_turret );

//         let l = model_transform.times( Mat4.translation( [0, 2, 0] ) )
//                                 .times( Mat4.scale( [0.05, 0.05, 2] ) );
//         this.shapes.laser.draw( graphics_state, l, this.materials.laser );

        model_transform = model_transform.times( Mat4.translation([0, 15, 20]) )
                                         .times( Mat4.rotation( -0.5, Vec.of(1,0,0) ) );
        graphics_state.camera_transform = Mat4.inverse( model_transform );
        
        //ground
        model_transform = Mat4.identity().times( Mat4.scale( [25, 20, 25] ) )
                                         .times( Mat4.translation([0,-0.1,0]) );
                                         //.times( Mat4.rotation(Math.PI/2, [1,0,0]) );
        this.shapes.ground.draw( graphics_state, model_transform, this.materials.ground );

        //enemies
        for (let i=0; i<this.enemy_pos.length; i++){
            model_transform = Mat4.identity().times( Mat4.rotation( this.enemy_pos[i][1], Vec.of(0,1,0) ) )
                                             .times( Mat4.translation( [this.enemy_pos[i][0],this.enemy_pos[i][2],0] ) )
                                             .times( Mat4.rotation( -Math.PI/2, [0,1,0] ))
                                             .times( Mat4.scale( [0.7,0.7,0.7] ) );
            let rand_index = this.enemy_pos[i][3];
            if (rand_index == 1) {
                  this.shapes.invader1.draw( graphics_state, model_transform, this.materials.invader1 );
            } else if (rand_index == 2) {
                  this.shapes.invader2.draw( graphics_state, model_transform, this.materials.invader2 );
            } else if (rand_index == 3) {
                  this.shapes.invader3.draw( graphics_state, model_transform, this.materials.invader3 );
            } else {
                  this.shapes.invader4.draw( graphics_state, model_transform, this.materials.invader4 );
            }
        }
        //lasers
        for (let i=0; i<this.laser_pos.length; i++){
            model_transform = Mat4.identity().times( Mat4.rotation( this.laser_pos[i][1], Vec.of(0,1,0) ) )
                                             .times( Mat4.translation( [this.laser_pos[i][0],3.4,0] ) )
                                             .times( Mat4.rotation( Math.PI/2, Vec.of(0,1,0) ) )
                                             .times( Mat4.scale( [0.05, 0.05, 1] ) );
                                             
            this.shapes.laser.draw( graphics_state, model_transform, this.materials.laser );
        }
        if(!this.gameOver)
        {
            this.update_enemy_pos();
            this.update_laser_pos();
            this.spawn_enemies(dt);
        }
        this.displayUI();
      }
      displayUI()
      {
            var score = document.getElementById("score");
            score.innerHTML = this.score;
            var gameOver = document.getElementById("gameover");
            if(this.gameOver)
            {
                  
                  gameOver.innerHTML = "Game Over. Press (p) to restart";
            }
            else
            {
                  gameOver.innerHTML = "";
            }

      }
      init_sounds(){
        this.sound.laser = new Audio('assets/sound/151025__bubaproducer__laser-shot-small-1.wav');
        this.sound.laser.load();
        this.sound.hit = new Audio('assets/sound/170149__timgormly__8-bit-hurt.wav');
        this.sound.hit.load();
      }
      smooth_camera()
      {
          this.camera_angle = this.camera_angle + (this.target_angle - this.camera_angle) * .2;
      }
      update_laser_pos( ){
          for (let i=0; i<this.laser_pos.length; i++){
              const radius = this.laser_pos[i][0];
              const angle = this.laser_pos[i][1];
              
              //check collision here
              if(radius > 20){
                  //remove laser
                  this.laser_pos.splice(i,1);
                  i--;
              } else{
                  this.laser_pos[i][0] += 0.08; //change this to be based on score
                  var result = this.check_laser_hit(radius, angle);
                  if(result){
                     this.laser_pos.splice(i,1);
                     i--; 
                  }
              }
              
          }
      }
      check_laser_hit( radius, angle ){
            const real_pos = [radius*Math.sin(angle), radius*Math.cos(angle)];
            var collision = false;
            for (let j=0; j<this.enemy_pos.length && !collision; j++){
                const r = this.enemy_pos[j][0];
                const a = this.enemy_pos[j][1];
                const rp = [r*Math.sin(a), r*Math.cos(a)];
                const dist = (rp[0]-real_pos[0])**2+(rp[1]-real_pos[1])**2;
                if(dist<2.7){
                    //collision!
                    //play sound
                    //this.sound.hit.play();
                    const newAudio = this.sound.hit.cloneNode()
                    newAudio.play();

                    //remove laser and enemy
                    collision = true;
                    this.enemy_pos.splice(j,1);
                    this.score +=10;
                    return true;
                }
            }
            return false;
      }
      update_enemy_pos( ){
          for (let i=0; i<this.enemy_pos.length; i++){
              if(this.enemy_pos[i][2]>3)
              {
                    this.enemy_pos[i][2]-=this.fallRate;
              }
              //check collision here
              else if(this.enemy_pos[i][0] < 2.0)
              {
                  this.gameOver=true;
                  //dont move
//                   this.enemy_pos.splice(i,1);
//                   i--;
              } 
              else
              {
                  this.enemy_pos[i][0] -= this.enemySpeed;
              }
              
          }
      }
      spawn_enemies(dt){
           if(this.enemy_pos.length < this.maxSpawn)
           {
               if(this.spawnTime >= this.spawnRate)
               {
                    var angleOffset = Math.random()* 2* Math.PI;
                    this.spawnAngle =angleOffset;
                    let rand_index = Math.ceil(Math.random() * Math.floor(4));
                    var new_pos = [this.spawnDistance, this.spawnAngle, this.spawnHeight, rand_index];
                    this.enemy_pos.push(new_pos);
                    this.spawnTime=0;
               }
               else
               {
                   this.spawnTime+=dt;
               }
                
             
           }
           this.maxSpawn = Math.floor(this.score/50) + 15;
           this.spawnRate = 2.0 - Math.floor(this.score/50)/6;
      }
      shoot_laser(){
          if(this.sound.laser.paused){
              var new_laser = [0.5, this.camera_angle+Math.PI/2];
            this.laser_pos.push(new_laser);
            this.sound.laser.play()
          }
//           const newAudio = this.laser_sound.cloneNode()
//           newAudio.volume = 0.2;
//           newAudio.play();
      }
      restart_game()
      {
            if(this.gameOver)
            {
                  this.score = 0;
                  this.gameOver=false;
                  this.enemy_pos = [];
                  this.laser_pos = [];
            }
            
      }
      

  }

class Texture_Scroll_X extends Phong_Shader
{ fragment_glsl_code()           // ********* FRAGMENT SHADER ********* 
    {
      // TODO:  Modify the shader below (right now it's just the same fragment shader as Phong_Shader) for requirement #6.
      return `
        uniform sampler2D texture;
        void main()
        { if( GOURAUD || COLOR_NORMALS )    // Do smooth "Phong" shading unless options like "Gouraud mode" are wanted instead.
          { gl_FragColor = VERTEX_COLOR;    // Otherwise, we already have final colors to smear (interpolate) across vertices.            
            return;
          }                                 // If we get this far, calculate Smooth "Phong" Shading as opposed to Gouraud Shading.
                                            // Phong shading is not to be confused with the Phong Reflection Model.
          vec4 tex_color = texture2D( texture, f_tex_coord );                         // Sample the texture image in the correct place.
                                                                                      // Compute an initial (ambient) color:
          if( USE_TEXTURE ) gl_FragColor = vec4( ( tex_color.xyz + shapeColor.xyz ) * ambient, shapeColor.w * tex_color.w ); 
          else gl_FragColor = vec4( shapeColor.xyz * ambient, shapeColor.w );
          gl_FragColor.xyz += phong_model_lights( N );                     // Compute the final color with contributions from lights.
        }`;
    }
}

class Texture_Rotate extends Phong_Shader
{ fragment_glsl_code()           // ********* FRAGMENT SHADER ********* 
    {
      // TODO:  Modify the shader below (right now it's just the same fragment shader as Phong_Shader) for requirement #7.
      return `
        uniform sampler2D texture;
        void main()
        { if( GOURAUD || COLOR_NORMALS )    // Do smooth "Phong" shading unless options like "Gouraud mode" are wanted instead.
          { gl_FragColor = VERTEX_COLOR;    // Otherwise, we already have final colors to smear (interpolate) across vertices.            
            return;
          }                                 // If we get this far, calculate Smooth "Phong" Shading as opposed to Gouraud Shading.
                                            // Phong shading is not to be confused with the Phong Reflection Model.
          vec4 tex_color = texture2D( texture, f_tex_coord );                         // Sample the texture image in the correct place.
                                                                                      // Compute an initial (ambient) color:
          if( USE_TEXTURE ) gl_FragColor = vec4( ( tex_color.xyz + shapeColor.xyz ) * ambient, shapeColor.w * tex_color.w ); 
          else gl_FragColor = vec4( shapeColor.xyz * ambient, shapeColor.w );
          gl_FragColor.xyz += phong_model_lights( N );                     // Compute the final color with contributions from lights.
        }`;
    }
}