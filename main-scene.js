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
                         laser: new Rounded_Capped_Cylinder(10,10)
                       }
        this.submit_shapes( context, shapes );

        // TODO:  Create the materials required to texture both cubes with the correct images and settings.
        //        Make each Material from the correct shader.  Phong_Shader will work initially, but when 
        //        you get to requirements 6 and 7 you will need different ones.
        this.materials =
          { 
            phong: context.get_instance( Phong_Shader ).material( Color.of( 1,1,0,1 ) ),
            ground: context.get_instance( Phong_Shader ).material( Color.of( 0.40, 0.26, 0.13, 1 ) ),
            player: context.get_instance( Phong_Shader ).material( Color.of( 0.20, 0.85, 0.20, 1 ) ),
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
        this.spawnRate = 2;
        this.spawnTime = 0;
        //angle in which we spawn new enemy 
        this.spawnAngle = 0;
        this.maxSpawn = 15;
        this.spawnDistance = 10;
        this.gameOver = false;
        this.sound = {};
        this.init_sounds();
        

        this.score = 0;

      }
    make_control_panel()
      { // TODO:  Implement requirement #5 using a key_triggered_button that responds to the 'c' key.
        this.key_triggered_button( "Rotate Left",  [ "1" ], () => this.target_angle += 0.1 );
        this.key_triggered_button( "Rotate Right",  [ "2" ], () => this.target_angle -= 0.1 );
        this.key_triggered_button( "Shoot Laser",  [ "3" ], () => this.shoot_laser() );
      }
    display( graphics_state )
      { graphics_state.lights = this.lights;        // Use the lights stored in this.lights.
        const t = graphics_state.animation_time / 1000, dt = graphics_state.animation_delta_time / 1000;

        // TODO:  Draw the required boxes. Also update their stored matrices.
        this.smooth_camera();
        //player
        let model_transform = Mat4.identity().times( Mat4.translation( [0, 2, 0] ) )
                                             .times( Mat4.rotation( this.camera_angle, Vec.of(0,1,0) ) );
        this.shapes.box.draw( graphics_state, model_transform, this.materials.player );

//         let l = model_transform.times( Mat4.translation( [0, 2, 0] ) )
//                                 .times( Mat4.scale( [0.05, 0.05, 2] ) );
//         this.shapes.laser.draw( graphics_state, l, this.materials.laser );

        model_transform = model_transform.times( Mat4.translation([0, 5, 7]) )
                                         .times( Mat4.rotation( -0.5, Vec.of(1,0,0) ) );
        graphics_state.camera_transform = Mat4.inverse( model_transform );
        
        //ground
        model_transform = Mat4.identity().times( Mat4.scale( [20, 1, 20] ) );
        this.shapes.box.draw( graphics_state, model_transform, this.materials.ground );

        //enemies
        for (let i=0; i<this.enemy_pos.length; i++){
            model_transform = Mat4.identity().times( Mat4.rotation( this.enemy_pos[i][1], Vec.of(0,1,0) ) )
                                             .times( Mat4.translation( [this.enemy_pos[i][0],2,0] ) );
            this.shapes.box.draw( graphics_state, model_transform, this.materials.phong );
        }
        //lasers
        for (let i=0; i<this.laser_pos.length; i++){
            model_transform = Mat4.identity().times( Mat4.rotation( this.laser_pos[i][1], Vec.of(0,1,0) ) )
                                             .times( Mat4.translation( [this.laser_pos[i][0],2,0] ) )
                                             .times( Mat4.rotation( Math.PI/2, Vec.of(0,1,0) ) )
                                             .times( Mat4.scale( [0.05, 0.05, 2] ) );
                                             
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
                  this.laser_pos[i][0] += 0.05;
                  const real_pos = [radius*Math.sin(angle), radius*Math.cos(angle)];
                  var collision = false;
                  for (let j=0; j<this.enemy_pos.length && !collision; j++){
                      const r = this.enemy_pos[j][0];
                      const a = this.enemy_pos[j][1];
                      const rp = [r*Math.sin(a), r*Math.cos(a)];
                      const dist = (rp[0]-real_pos[0])**2+(rp[1]-real_pos[1])**2;
                      if(dist<3){
                          //collision!
                          //play sound
                          //this.sound.hit.play();
                          const newAudio = this.sound.hit.cloneNode()
                          newAudio.play();

                          //remove laser and enemy
                          this.laser_pos.splice(i,1);
                          i--;
                          collision = true;
                          this.enemy_pos.splice(j,1);
                      }
                  }
              }
              
          }
      }
      update_enemy_pos( ){
          for (let i=0; i<this.enemy_pos.length; i++){
              
              //check collision here
              if(this.enemy_pos[i][0] < 2.0){
                  //this.gameOver=true;
                  //dont move
                  this.enemy_pos.splice(i,1);
                  i--;
              } else{
                  this.enemy_pos[i][0] -= 0.01;
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
                    var new_pos = [this.spawnDistance, this.spawnAngle];
                    this.enemy_pos.push(new_pos);
                    this.spawnTime=0;
               }
               else
               {
                   this.spawnTime+=dt;
               }
                
             
           }
      }
      shoot_laser(){
          if(this.sound.laser.paused){
              var new_laser = [0, this.camera_angle+Math.PI/2];
            this.laser_pos.push(new_laser);
            this.sound.laser.play()
          }
          
//           const newAudio = this.laser_sound.cloneNode()
//           newAudio.volume = 0.2;
//           newAudio.play();
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